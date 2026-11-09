import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import {randomInt, randomBytes} from 'node:crypto';
import {starters as base,combine,allEmojis,recipeStats,emojiOf,knownCombination,registerLocalCombination} from './recipe-engine.js';
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static('public'));
app.get('/api/status',(_req,res)=>res.json({aiConfigured:Boolean(process.env.GEMINI_API_KEY),...recipeStats()}));
const rooms=new Map(),players=new Map();
const localLimits=new Map();
const targets=['Spaceship','Dragon','Black Hole','Computer','Volcano','Robot','Pizza','Time Machine','Unicorn','Galaxy','Electricity','Internet','Dinosaur','Castle','Music','Moon','Supernova','Chocolate','Pirate','Laser','Video Game'];
const bingoPool=['Steam','Dust','Mud','Lava','Rain','Cloud','Ocean','Lake','Island','Mountain','Volcano','Stone','Sand','Glass','Plant','Tree','Forest','Flower','Garden','Fruit','Seed','Swamp','Life','Animal','Bird','Fish','Dinosaur','Dragon','Human','House','City','Country','Planet','Moon','Sun','Star','Galaxy','Space','Rocket','Spaceship','Robot','Machine','Computer','Internet','Electricity','Energy','Lightning','Storm','Snow','Ice','Rainbow','Music','Song','Book','Paper','Fireworks','Smoke','Fog','Windmill','Metal','Wood','Brick','Castle','Clock','Time','Steam Engine','Car','Train','Boat','Ocean','Beach','Desert','Waterfall','Diamond','Gold','Earthquake','Tornado','Hurricane','Fog','Grass','Jungle','Farm','Bread','Pizza','Chocolate','Coffee','Tea','Soup','Bacteria','Evolution','Fossil','Magic','Wizard','Unicorn','Phoenix','Alien','Satellite','Black Hole','Universe','Game','Video Game','Guitar','Piano','Science','Technology','Laser','Solar System','Night','Day'];
const colors=['#e85d75','#3c8df0','#22a68a','#bc77ec','#f29e38','#6575da','#e26bb0','#6a9b30','#d26a49','#179aaf'];
const difficultyPools={easy:['Steam','Mud','Dust','Rain','Tree','Cloud','Lake','Stone','Smoke','Mountain','Sand','Glass','Plant','Ice','Flower','Rainbow'],medium:['Volcano','Robot','Electricity','Dinosaur','Galaxy','Spaceship','Castle','Computer','Tornado','Forest','Rainbow','Ocean','Dragon','Time Machine','Satellite'],hard:['Black Hole','Supernova','Artificial Intelligence','Quantum Computer','Interstellar','Cyberpunk','Wormhole','Dyson Sphere','Nanotechnology','Terraforming']};
const themed={cyberpunk:{easy:['Neon','Robot','City','Metal','Electricity','Computer','Night'],medium:['Cyberpunk','Hacker','Cybernetics','Android','Laser','Megacity','Drone','Artificial Intelligence'],hard:['Neural Interface','Cybernetic Uprising','Quantum Computer','Digital Immortality','Singularity']},fantasy:{easy:['Castle','Dragon','Magic','Sword','Wizard','Unicorn'],medium:['Phoenix','Enchantment','Kingdom','Spell','Dungeon','Excalibur'],hard:['Elder Dragon','Immortality','Necromancy','Arcane Empire']},space:{easy:['Moon','Star','Planet','Rocket','Sun'],medium:['Galaxy','Spaceship','Satellite','Black Hole','Solar System'],hard:['Supernova','Wormhole','Dyson Sphere','Terraforming','Interstellar']},nature:{easy:['Tree','Forest','Rain','Mountain','Flower','Lake'],medium:['Volcano','Hurricane','Dinosaur','Coral Reef','Earthquake'],hard:['Ecosystem','Evolution','Photosynthesis','Biodiversity']},technology:{easy:['Machine','Computer','Electricity','Car','Robot'],medium:['Internet','Satellite','Laser','Video Game','Artificial Intelligence'],hard:['Nanotechnology','Quantum Computer','Singularity','Fusion Reactor']}};
const normalize=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
function parseTargets(input){const raw=Array.isArray(input)?input:String(input||'').split(/[,\n;]+/);const found=[],seen=new Set();for(const item of raw){const w=String(item||'').trim().replace(/\s+/g,' ');const k=normalize(w);if(!w||seen.has(k))continue;if(w.length>55||!(/^[A-Za-z0-9][A-Za-z0-9 '\-]*$/.test(w)))throw Error('Use short word or phrase targets, separated by commas');if(base.some(b=>normalize(b)===k))throw Error('Starting elements cannot be bingo squares');seen.add(k);found.push(w)}return found}
function pickPool(category,difficulty){const key=String(category||'').toLowerCase().trim();const group=Object.keys(themed).find(k=>key.includes(k));return group?themed[group][difficulty]:difficultyPools[difficulty]}
function pickTargets(category,difficulty,count){const pool=pickPool(category,difficulty);const out=[...new Set(pool)].filter(w=>!base.some(b=>normalize(b)===normalize(w)));for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]]}return out.slice(0,count)}
function makeBoard(size,custom,category='',difficulty='medium'){const requested=parseTargets(custom);const required=size*size;if(requested.length>required)throw Error(`Only ${required} squares fit on a ${size}×${size} board`);const used=new Set(requested.map(normalize)),preferred=pickTargets(category,difficulty,100),pool=[...preferred,...bingoPool.filter(w=>!preferred.some(p=>normalize(p)===normalize(w)))].filter(w=>!used.has(normalize(w)));if(!String(category||'').trim())for(let i=pool.length-1;i>0;i--){const j=randomInt(i+1);[pool[i],pool[j]]=[pool[j],pool[i]]}for(const word of pool){if(requested.length===required)break;const k=normalize(word);if(!used.has(k)){requested.push(word);used.add(k)}}if(requested.length!==required)throw Error('Not enough unique targets for this board');for(let i=requested.length-1;i>0;i--){const j=randomInt(i+1);[requested[i],requested[j]]=[requested[j],requested[i]]}return requested}
async function aiCategoryTargets(category,difficulty,count){
 if(!process.env.GEMINI_API_KEY||!category||Object.keys(themed).some(k=>category.toLowerCase().includes(k)))return [];
 const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';
 try{
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',signal:AbortSignal.timeout(9000),headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:`Generate exactly ${count} unique, recognizable target words or short noun phrases that a player could craft in an Infinite Craft game, all clearly related to this category: ${JSON.stringify(category)}. Difficulty is ${difficulty} (easy simple objects, medium specific things, hard advanced niche concepts). Do not include the four starting elements Water, Fire, Wind, Earth. JSON only {"targets":["word",...]}.` }]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:650,temperature:.75}})});
  if(!response.ok)return [];const json=await response.json();const content=json.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}';return parseTargets(JSON.parse(content).targets||[]).slice(0,count);
 }catch{return []}
}
function scores(room){const result={};for(const id of room.players)result[id]=room.owners.filter(owner=>owner===id).length;return result}
function roomView(room){return {code:room.code,host:room.host,phase:room.phase,mode:room.mode,size:room.size,board:room.board,owners:room.owners,round:room.round,target:room.target,players:[...room.players].map(id=>({id,name:players.get(id)?.name||'Player',count:players.get(id)?.bank.size||0,score:room.owners.filter(owner=>owner===id).length,color:colors[[...room.players].indexOf(id)%colors.length]})),winner:room.winner,winningIds:room.winningIds||[],winReason:room.winReason||'',category:room.category||'',difficulty:room.difficulty||'medium',duration:room.duration||90,endsAt:room.endsAt||null,submissions:room.submissions||{},battle:room.battle||null,preview:room.phase==='preparing'?room.preview||null:null}}
function emitRoom(room){io.to(room.code).emit('room',roomView(room))}
function leave(socket){const p=players.get(socket.id);if(!p?.room)return;const room=rooms.get(p.room);socket.leave(p.room);p.room=null;if(!room)return;room.players.delete(socket.id);if(room.submissions)delete room.submissions[socket.id];if(!room.players.size){rooms.delete(room.code);return}if(room.host===socket.id)room.host=[...room.players][0];emitRoom(room)}
function ackError(cb,msg){cb?.({ok:false,error:msg})}
function finish(room,ids,reason){if(room.phase!=='racing')return;room.phase='finished';room.winningIds=ids;room.winner=ids.map(id=>players.get(id)?.name||'Player').join(' & ');room.winReason=reason;io.to(room.code).emit('win',{name:room.winner,ids,reason,mode:room.mode,board:room.board,owners:room.owners,scores:scores(room),battle:room.battle||null});emitRoom(room)}
function checkBingo(room,id){const n=room.size,owned=i=>room.owners[i]===id;for(let r=0;r<n;r++)if(Array.from({length:n},(_,c)=>r*n+c).every(owned))return 'Completed a full row!';for(let c=0;c<n;c++)if(Array.from({length:n},(_,r)=>r*n+c).every(owned))return 'Completed a full column!';if(Array.from({length:n},(_,i)=>i*n+i).every(owned)||Array.from({length:n},(_,i)=>i*n+(n-1-i)).every(owned))return 'Completed a diagonal!';return null}
const battleWords=[['universe',100],['multiverse',110],['black hole',98],['supernova',93],['god',105],['singularity',99],['time machine',96],['dragon',68],['nuclear',83],['laser',55],['robot',45],['magic',65],['spaceship',63],['volcano',52],['sword',23],['human',12],['steam',4]];
function power(word){const w=normalize(word);let score=15;for(const [term,val] of battleWords)if(w.includes(term))score=Math.max(score,val);for(const t of ['quantum','cosmic','immortal','galactic','apocalypse','infinite','ultimate'])if(w.includes(t))score+=8;score+=Math.min(15,Math.round(word.length/4));return Math.min(score,145)}
async function resolveBattle(room,round){if(rooms.get(room.code)!==room||room.round!==round||room.phase!=='racing')return;const entries=[...room.players].map(id=>({id,name:players.get(id)?.name||'Player',word:room.submissions[id]||'No submission',score:room.submissions[id]?power(room.submissions[id]):0,emoji:emojiOf(room.submissions[id]||'')}));entries.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));let narration=`${entries[0]?.word||'Nothing'} overwhelms the arena!`;if(entries.length>1)narration=`${entries[0].word} defeats ${entries[1].word} in an explosive showdown!`;
// Optional AI judge is a single API call for the whole match. Deterministic scores work without an API key.
if(process.env.GEMINI_API_KEY&&entries.filter(x=>x.score>0).length>1){try{const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',signal:AbortSignal.timeout(5500),headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:`You referee a playful fantasy battle. Decide which of these items would be most powerful in a battle, using coherent fictional reasoning, without favouring complicated names: ${JSON.stringify(entries.map(x=>({id:x.id,word:x.word})))}. Reply JSON only {"winnerId":"exact id","narration":"one exciting sentence"}.` }]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:120,temperature:.35}})});if(response.ok){const j=await response.json(),v=JSON.parse(j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}');const chosen=entries.find(e=>e.id===v.winnerId&&e.score>0);if(chosen){entries.sort((a,b)=>a===chosen?-1:b===chosen?1:b.score-a.score);narration=String(v.narration||narration).slice(0,220)}}}catch{}}
if(room.round!==round||room.phase!=='racing')return;room.battle={entries,narration};const top=entries[0];finish(room,top?.score?[top.id]:[],top?.score?narration:'Nobody submitted an item!')}
io.on('connection',socket=>{players.set(socket.id,{name:'Player',bank:new Set(base),room:null});socket.emit('bank',base);socket.emit('emojis',allEmojis());
socket.on('name',name=>{const p=players.get(socket.id);if(!p)return;p.name=String(name||'Player').trim().slice(0,20)||'Player';if(p.room&&rooms.has(p.room))emitRoom(rooms.get(p.room))});
socket.on('create',(_data,cb)=>{leave(socket);let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase()}while(rooms.has(code));const room={code,host:socket.id,players:new Set([socket.id]),phase:'waiting',mode:'word',size:3,board:[],owners:[],round:0,target:null,winner:null,winningIds:[],winReason:'',category:'',difficulty:'medium',duration:90,endsAt:null,submissions:{},battle:null};rooms.set(code,room);players.get(socket.id).room=code;socket.join(code);emitRoom(room);cb?.({ok:true,code})});
socket.on('join',(raw,cb)=>{const code=String(raw||'').trim().toUpperCase(),room=rooms.get(code);if(!room)return ackError(cb,'Lobby not found');if(room.phase==='racing')return ackError(cb,'Race already started');leave(socket);room.players.add(socket.id);players.get(socket.id).room=code;socket.join(code);emitRoom(room);cb?.({ok:true,code})});
socket.on('leave',()=>{leave(socket);socket.emit('room',null)});
socket.on('prepareStart',(data,cb)=>{
 const p=players.get(socket.id),room=rooms.get(p?.room);
 if(!room||room.host!==socket.id)return ackError(cb,'Only the host can prepare a round');
 if(room.phase==='racing'||room.phase==='preparing')return ackError(cb,'Round already underway');
 const mode=data?.mode==='bingo'?'bingo':'word',size=Number(data?.size)||3;
 if(mode==='bingo'&&![3,4,5].includes(size))return ackError(cb,'Invalid bingo size');
 let initial=[];
 try{
  if(mode==='bingo'){
   const custom=parseTargets(data?.custom||'');
   if(custom.length>size*size)return ackError(cb,'Too many custom targets');
   initial=data?.category?.trim()?custom:makeBoard(size,custom,'',data?.difficulty||'medium');
  }
 }catch(e){return ackError(cb,e.message)}
 room.phase='preparing';room.preview={mode,size,words:[],total:mode==='bingo'?size*size:1,category:String(data?.category||'').slice(0,45)};
 const token=room.preview;
 emitRoom(room);cb?.({ok:true});
 if(initial.length){
  // Reveal words one by one in the SAME order used when the race starts.
  initial.forEach((word,i)=>setTimeout(()=>{
   if(room.phase!=='preparing'||room.preview!==token)return;
   if(!token.words.some(x=>normalize(x)===normalize(word)))token.words.push(word);
   emitRoom(room);
  },i*125+100));
 }
});
socket.on('preparationProgress',(data,cb)=>{
 const p=players.get(socket.id),room=rooms.get(p?.room);
 if(!room||room.host!==socket.id||room.phase!=='preparing'||!room.preview)return ackError(cb,'No round is being prepared');
 try{
  const words=parseTargets(data?.words||[]);
  for(const word of words){
   if(room.preview.words.length>=room.preview.total)break;
   if(!room.preview.words.some(x=>normalize(x)===normalize(word)))room.preview.words.push(word);
  }
  emitRoom(room);cb?.({ok:true,count:room.preview.words.length});
 }catch(e){ackError(cb,e.message)}
});
socket.on('cancelPreparation',(_data,cb)=>{
 const p=players.get(socket.id),room=rooms.get(p?.room);
 if(room&&room.host===socket.id&&room.phase==='preparing'){
  room.phase='waiting';room.preview=null;emitRoom(room);cb?.({ok:true});
 }
});
socket.on('start',async(data,cb)=>{const p=players.get(socket.id),room=rooms.get(p?.room);if(!room||room.host!==socket.id)return ackError(cb,'Only the host can start');if(room.phase==='racing')return ackError(cb,'Race already underway');const mode=['bingo','battle'].includes(data?.mode)?data.mode:'word';const difficulty=['easy','medium','hard'].includes(data?.difficulty)?data.difficulty:'medium';const category=String(data?.category||'').trim().slice(0,45);const duration=Math.max(15,Math.min(900,Number(data?.duration)||90));let target=null,board=[],size=3;try{const needsTheme=Boolean(category)&&mode!=='battle'&&(mode==='bingo'||!String(data?.target||'').trim());
 const generated=needsTheme?parseTargets(data?.preparedTargets||[]):[];
 if(needsTheme&&generated.some(w=>/\b(characters?|scenes?|items?|things?|concepts?|objects?|genre|theme|elements?|locations?)\b/i.test(w)))return ackError(cb,'Targets must be specific craftable words, not categories like Characters or Scenes.');
 const requested=mode==='bingo'?parseTargets(data?.custom||''):[];
 const remaining=mode==='bingo'?Math.max(0,Number(data?.size)**2-requested.length):1;
 if(needsTheme&&generated.length<remaining)return ackError(cb,'The themed AI targets are not ready. Prepare them before starting.');if(mode==='word'){target=String(data?.target||'').trim().replace(/\s+/g,' ').slice(0,55)||generated[0]||pickTargets(category,difficulty,1)[0]||targets[randomInt(targets.length)];if(base.some(x=>normalize(x)===normalize(target)))return ackError(cb,'Choose a target beyond the starting elements')}else if(mode==='bingo'){size=Number(data?.size);if(![3,4,5].includes(size))return ackError(cb,'Choose 3×3, 4×4 or 5×5');board=room.preview?.mode==='bingo'&&room.preview.size===size&&room.preview.words.length===size*size?[...room.preview.words]:makeBoard(size,[...requested,...generated].slice(0,size*size),category,difficulty)}}catch(e){return ackError(cb,e.message)}room.round++;room.category=category;room.difficulty=difficulty;room.duration=duration;room.endsAt=mode==='battle'?Date.now()+duration*1000:null;room.submissions={};room.battle=null;room.mode=mode;room.target=target;room.size=size;room.board=board;room.owners=board.map(()=>null);room.phase='racing';room.preview=null;room.winner=null;room.winningIds=[];room.winReason='';for(const id of room.players){const player=players.get(id);if(!player)continue;player.bank=new Set(base);io.to(id).emit('bank',base);io.to(id).emit('discovery',{message:'New race! Your discoveries are reset.'})}emitRoom(room);cb?.({ok:true});if(mode==='battle'){const round=room.round;setTimeout(()=>resolveBattle(room,round),duration*1000)}});
socket.on('submitBattle',(raw,cb)=>{const p=players.get(socket.id),room=rooms.get(p?.room);if(!room||room.mode!=='battle'||room.phase!=='racing')return ackError(cb,'No active battle');if(Date.now()>room.endsAt)return ackError(cb,'Time is up');const word=String(raw||'').trim();if(!p.bank.has(word)||base.includes(word))return ackError(cb,'Discover an item first');room.submissions[socket.id]=word;emitRoom(room);cb?.({ok:true})});
async function commitCraft(p,room,round,crafted,cb){
const {word:result,emoji}=crafted;if(!players.has(socket.id)||players.get(socket.id)!==p)return ackError(cb,'Player disconnected');const current=rooms.get(p.room);if(room&&(current!==room||current.round!==round||current.phase!=='racing'))return ackError(cb,'The round changed while crafting. Try in the next race.');const fresh=!p.bank.has(result);p.bank.add(result);socket.emit('bank',[...p.bank]);io.emit('emoji',{word:result,emoji});cb?.({ok:true,result,emoji,fresh});if(!current)return;const winKey=normalize(result);if(current.mode==='word'&&winKey===normalize(current.target)){finish(current,[socket.id],`Discovered ${current.target}!`);return}if(current.mode==='battle'){emitRoom(current);return}if(current.mode==='bingo'){const index=current.board.findIndex((word,i)=>normalize(word)===winKey&&current.owners[i]===null);if(index!==-1){current.owners[index]=socket.id;io.to(current.code).emit('claim',{index,word:current.board[index],player:p.name,id:socket.id});const reason=checkBingo(current,socket.id);if(reason){finish(current,[socket.id],reason);return}if(current.owners.every(x=>x!==null)){const totals=scores(current),top=Math.max(...Object.values(totals));finish(current,Object.keys(totals).filter(id=>totals[id]===top),`Board filled — highest score: ${top}`);return}}}emitRoom(current) }
async function requestCraft(data,cb,localProposal=false){
 const p=players.get(socket.id);if(!p)return;
 const a=String(data?.a||'').slice(0,60),b=String(data?.b||'').slice(0,60);
 if(!p.bank.has(a)||!p.bank.has(b))return ackError(cb,'You must discover both ingredients first');
 const room=rooms.get(p.room),round=room?.round;
 if(room&&room.phase!=='racing')return ackError(cb,room.phase==='finished'?'Race finished. Wait for another race.':'Wait for the host to start');
 let crafted=knownCombination(a,b);
 if(!crafted){
   if(!localProposal)return cb?.({ok:false,needsLocal:true});
   const now=Date.now(),limit=localLimits.get(socket.id)||{t:now,n:0};
   if(now-limit.t>60_000){limit.t=now;limit.n=0}if(++limit.n>24)return ackError(cb,'Too many new recipes per minute');localLimits.set(socket.id,limit);
   try{crafted=registerLocalCombination(a,b,data?.word,data?.emoji)}catch(e){return ackError(cb,e.message)}
 }
 return commitCraft(p,room,round,crafted,cb);
}
socket.on('combine',(data,cb)=>requestCraft(data,cb,false));
socket.on('localCombine',(data,cb)=>requestCraft(data,cb,true));
socket.on('reset',()=>{const p=players.get(socket.id);if(!p||p.room)return;p.bank=new Set(base);socket.emit('bank',base)});
socket.on('disconnect',()=>{leave(socket);players.delete(socket.id);localLimits.delete(socket.id)})});
server.listen(process.env.PORT||3000,()=>console.log('Infinite Race running on port '+(process.env.PORT||3000)));
