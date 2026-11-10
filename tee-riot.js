import {randomBytes} from 'node:crypto';

// TEE RIOT: original T-shirt design and slogan tournament. No external AI or database.
export function attachTeeRiot(io){
 const ns=io.of('/tee');
 const rooms=new Map(),members=new Map();
 const prompts=["An angry toaster at a job interview","A crocodile running a bakery","A frog driving a tiny race car","A haunted computer keyboard","A dinosaur doing yoga","A shark afraid of swimming","A pizza slice trying to escape","A potato in a royal crown","A pigeon running for mayor","A robot having an existential crisis","A jellyfish wearing roller skates","A cat piloting a spaceship","A duck stealing a traffic cone","A snail winning a marathon","A medieval knight using a laptop","A banana with a superhero cape","A sad cactus on holiday","A fish playing electric guitar","A raccoon starting a band","A dinosaur as a barista","A cloud with a suspicious moustache","A crab boxing a lobster","A bewildered alien at the supermarket","A penguin performing magic tricks","A coffee cup that has had enough","A shark selling lemonade","An egg in a suit","A ghost trying to use a phone","A whale wearing sunglasses","A cheese wheel going to school","A dragon at the dentist","A rat in a fancy restaurant","A hamster in a tank","A mushroom holding a microphone","A grumpy planet Earth","A rocket powered by noodles","An octopus operating a forklift","A seagull eating a laptop","A burger with bodybuilder arms","A squirrel at a disco","A nervous vampire on a beach","A toaster fighting a washing machine","A goose wearing business attire","A skeleton in a hot tub","A flamingo learning to drive","A cactus playing basketball","A haunted sandwich","A worm in a cowboy hat","A robot vacuum ruling the world","A racing go-kart powered by a giant duck","A turtle with enormous sneakers","An evil stapler with laser eyes","A giant frog eating a planet","A donut trapped in space","A confused wizard at a gym","A lawnmower in a rock band","A clownfish piloting a tank","A haunted traffic light","A dinosaur on a tiny bicycle","A pineapple robbing a bank"];
 const fallbackSlogans=["MY LAWYER SAID NO","THIS SEEMED SMARTER YESTERDAY","100% QUESTIONABLE","SOMEONE STOP ME","I WAS NEVER HERE","UNSUPERVISED ACTIVITY","DO NOT ASK QUESTIONS","WORLD'S WORST EXPERT","IT GETS WORSE","THIS IS FINE"];
 const shirtColors=new Set(["#ffffff","#191c29","#ffe2e4","#d2efff","#fff0ac","#d8f9da","#e9ddff","#f0d8bc","#fdd5bd"]);
 const clean=(x,n=100)=>String(x||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
 const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=randomBytes(2).readUInt16BE(0)%(i+1);[b[i],b[j]]=[b[j],b[i]]}return b};
 const code=()=>{let c;do{c=randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(c));return c};
 const fail=(ack,message)=>ack?.({ok:false,error:message});
 const get=socket=>rooms.get(members.get(socket.id));
 const stop=r=>{if(r.timer)clearTimeout(r.timer);r.timer=null};
 const schedule=(r,ms,fn)=>{stop(r);r.endsAt=Date.now()+ms;r.timer=setTimeout(()=>{r.timer=null;fn(r)},ms)};
 const playerList=r=>[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score})).sort((a,b)=>b.score-a.score);
 const shirt=(r,id)=>{
  if(!id)return null;
  const sh=r.shirts.get(id);
  if(!sh)return null;
  return {id,artist:sh.artist,art:sh.art,color:sh.color,slogan:sh.slogan,sloganBy:sh.sloganBy};
 };
 function state(r){
  const duel=r.duel;
  return {
   code:r.code,host:r.host,stage:r.stage,players:playerList(r),
   endsAt:r.endsAt,done:r.stage==='drawing'?r.drawings.size:r.stage==='slogans'?r.slogans.size:r.stage==='duel'?r.votes.size:0,
   total:r.players.size,round:r.round,totalRounds:r.totalRounds,
   match:r.matchIndex+1,totalMatches:r.totalMatches,
   duel:r.stage==='duel'&&duel?{left:shirt(r,duel.left),right:shirt(r,duel.right),voters:r.votes.size,eligible:r.eligible.length}:null,
   result:r.stage==='reveal'?r.latestResult:null,
   history:r.history.map(m=>({round:m.round,left:r.players.get(m.left)?.name||'Player',right:m.right?r.players.get(m.right)?.name||'Player':'BYE',winner:r.players.get(m.winner)?.name||'Player',score:m.score})),
   champion:r.stage==='finished'?shirt(r,r.champion):null,
   finishReason:r.stage==='finished'?r.finishReason:null
  };
 }
 function taskFor(r,id){
  return {
   stage:r.stage,round:r.round,
   prompt:r.stage==='drawing'?r.prompts.get(id)||'Draw anything funny!':null,
   already:r.stage==='drawing'?r.drawings.has(id):r.stage==='slogans'?r.slogans.has(id):r.stage==='duel'?r.votes.has(id):false,
   canVote:r.stage==='duel'?r.eligible.includes(id):false
  };
 }
 function send(r){
  ns.to(r.code).emit('state',state(r));
  for(const id of r.players.keys())ns.to(id).emit('task',taskFor(r,id));
 }
 function progress(r){
  ns.to(r.code).emit('progress',{stage:r.stage,done:r.stage==='drawing'?r.drawings.size:r.stage==='slogans'?r.slogans.size:r.votes.size,total:r.players.size});
 }
 function end(r,reason=''){
  stop(r);r.stage='finished';r.endsAt=null;r.finishReason=reason;
  send(r);
 }
 function beginning(r){
  r.stage='drawing';r.drawings=new Map();r.slogans=new Map();r.shirts=new Map();r.history=[];r.votes=new Map();r.latestResult=null;
  r.prompts=new Map();
  const shuffled=shuffle(prompts),ids=shuffle([...r.players.keys()]);
  ids.forEach((id,i)=>r.prompts.set(id,shuffled[i%shuffled.length]));
  schedule(r,170000,beginSlogans);send(r);
 }
 function beginSlogans(r){
  if(r.stage!=='drawing')return;
  r.stage='slogans';
  schedule(r,70000,makeShirts);send(r);
 }
 function makeShirts(r){
  if(r.stage!=='slogans')return;
  if(r.players.size<3){end(r,'Not enough players left to finish.');return}
  const owners=shuffle([...r.players.keys()]);
  // Rotate the slogan author so no shirt uses its own artist's slogan.
  const sloganAuthors=owners.slice(1).concat(owners[0]);
  r.shirts=new Map();
  for(let i=0;i<owners.length;i++){
   const id=owners[i],writer=sloganAuthors[i],saved=r.drawings.get(id);
   const captions=r.slogans.get(writer)||[];
   const line=captions.filter(Boolean)[Math.floor(Math.random()*Math.max(1,captions.filter(Boolean).length))]||fallbackSlogans[i%fallbackSlogans.length];
   r.shirts.set(id,{
    artist:r.players.get(id)?.name||'Player',art:saved?.image||null,color:saved?.color||'#ffffff',
    slogan:line,sloganBy:r.slogans.has(writer)?r.players.get(writer)?.name||'Player':'The Game',writer:r.slogans.has(writer)?writer:null
   });
  }
  const size=2**Math.ceil(Math.log2(Math.max(4,owners.length))),slots=Array(size).fill(null),seeds=size/2;
  owners.forEach((id,i)=>{slots[i<seeds?2*i:2*(i-seeds)+1]=id});
  r.contenders=slots;r.nextContenders=[];r.round=1;r.totalRounds=Math.log2(size);r.totalMatches=owners.length-1;r.matchIndex=0;r.history=[];r.duel=null;
  nextMatch(r);
 }
 function nextMatch(r){
  if(r.players.size<3){end(r,'Not enough players left to finish.');return}
  // Move through the bracket; automatic byes carry a shirt forward.
  while(true){
   if(r.contenders.length===1){
    r.champion=r.contenders[0];r.finishReason='';end(r);return;
   }
   if(r.matchIndex>=r.contenders.length/2){
    r.contenders=r.nextContenders;r.nextContenders=[];r.matchIndex=0;r.round++;continue;
   }
   const left=r.contenders[r.matchIndex*2],right=r.contenders[r.matchIndex*2+1];
   if(!left&&!right){r.matchIndex++;continue}
   if(!left||!right){
    const winner=left||right;
    r.nextContenders.push(winner);r.history.push({round:r.round,left:left||right,right:null,winner,score:[0,0]});
    r.matchIndex++;continue;
   }
   r.stage='duel';r.duel={left,right};r.votes=new Map();
   r.eligible=[...r.players.keys()].filter(id=>id!==left&&id!==right);
   schedule(r,30000,resolveDuel);send(r);return;
  }
 }
 function resolveDuel(r){
  if(r.stage!=='duel'||!r.duel)return;
  const {left,right}=r.duel;
  const count=[0,0];
  for(const choice of r.votes.values())if(choice===left)count[0]++;else if(choice===right)count[1]++;
  // A genuine tie is settled randomly, rather than always favouring the left shirt.
  const winner=count[0]===count[1]?(randomBytes(1)[0]%2===0?left:right):(count[0]>count[1]?left:right);
  const loser=winner===left?right:left;
  r.nextContenders.push(winner);
  const give=(id,value)=>{const p=r.players.get(id);if(p)p.score+=value};
  for(const [id,votes] of [[left,count[0]],[right,count[1]]]){
   give(id,votes*100);
   const writer=r.shirts.get(id)?.writer;
   if(writer)give(writer,votes*40);
  }
  r.history.push({round:r.round,left,right,winner,score:count});
  r.latestResult={left:shirt(r,left),right:shirt(r,right),winner,loser,votes:count,tie:count[0]===count[1]};
  r.stage='reveal';
  schedule(r,6500,afterReveal);send(r);
 }
 function afterReveal(r){
  if(r.stage!=='reveal')return;
  r.matchIndex++;nextMatch(r);
 }
 function leave(socket){
  const roomCode=members.get(socket.id);members.delete(socket.id);if(!roomCode)return;
  socket.leave(roomCode);const r=rooms.get(roomCode);if(!r)return;
  r.players.delete(socket.id);r.drawings.delete(socket.id);r.slogans.delete(socket.id);r.votes.delete(socket.id);
  if(!r.players.size){stop(r);rooms.delete(roomCode);return}
  if(r.host===socket.id)r.host=r.players.keys().next().value;
  if(!['lobby','finished'].includes(r.stage)&&r.players.size<3){r.champion=null;end(r,'Not enough players left to finish.');return}
  if(r.stage==='drawing'&&r.drawings.size>=r.players.size)beginSlogans(r);
  else if(r.stage==='slogans'&&r.slogans.size>=r.players.size)makeShirts(r);
  else if(r.stage==='duel'&&r.eligible?.every(id=>r.votes.has(id)))resolveDuel(r);
  else send(r);
 }
 ns.on('connection',socket=>{
  socket.on('create',(data,ack)=>{
   leave(socket);
   const roomCode=code(),name=clean(data?.name,22)||'Player';
   const r={code:roomCode,host:socket.id,stage:'lobby',players:new Map(),timer:null,endsAt:null,
    drawings:new Map(),slogans:new Map(),prompts:new Map(),shirts:new Map(),round:0,totalRounds:0,totalMatches:0,matchIndex:0,
    history:[],duel:null,votes:new Map(),eligible:[],latestResult:null,champion:null,finishReason:null};
   r.players.set(socket.id,{id:socket.id,name,score:0});
   rooms.set(roomCode,r);members.set(socket.id,roomCode);socket.join(roomCode);
   ack?.({ok:true,code:roomCode});send(r);
  });
  socket.on('join',(data,ack)=>{
   const roomCode=clean(data?.code,6).toUpperCase(),r=rooms.get(roomCode);
   if(!r)return fail(ack,'Room not found.');
   if(!['lobby','finished'].includes(r.stage))return fail(ack,'Game already in progress. Join the next one!');
   if(r.players.size>=12)return fail(ack,'Room full (12 players maximum).');
   leave(socket);
   const name=clean(data?.name,22)||'Player';
   r.players.set(socket.id,{id:socket.id,name,score:0});members.set(socket.id,roomCode);socket.join(roomCode);
   ack?.({ok:true,code:roomCode});send(r);
  });
  socket.on('leave',(_,ack)=>{leave(socket);socket.emit('state',null);ack?.({ok:true})});
  socket.on('start',(_,ack)=>{
   const r=get(socket);
   if(!r||r.host!==socket.id)return fail(ack,'Only the host can start.');
   if(!['lobby','finished'].includes(r.stage))return fail(ack,'Game already running.');
   if(r.players.size<3)return fail(ack,'You need at least three players.');
   for(const p of r.players.values())p.score=0;
   r.champion=null;r.finishReason=null;beginning(r);ack?.({ok:true});
  });
  socket.on('drawing',(data,ack)=>{
   const r=get(socket);
   if(!r||r.stage!=='drawing'||!r.players.has(socket.id))return fail(ack,'Drawing round is closed.');
   if(r.drawings.has(socket.id))return fail(ack,'Your artwork is already submitted.');
   const image=String(data?.image||'');
   const valid=/^data:image\/(?:png|webp);base64,[a-zA-Z0-9+/=]+$/.test(image);
   if(!valid||image.length<60||image.length>460000)return fail(ack,'Artwork format invalid or too large. Try a smaller drawing.');
   const color=shirtColors.has(data?.color)?data.color:'#ffffff';
   r.drawings.set(socket.id,{image,color});ack?.({ok:true});
   if(r.drawings.size>=r.players.size)beginSlogans(r);else{progress(r);ns.to(socket.id).emit('task',taskFor(r,socket.id))}
  });
  socket.on('slogans',(data,ack)=>{
   const r=get(socket);
   if(!r||r.stage!=='slogans'||!r.players.has(socket.id))return fail(ack,'Slogan round is closed.');
   if(r.slogans.has(socket.id))return fail(ack,'Slogans already submitted.');
   const lines=[clean(data?.first,70),clean(data?.second,70)].filter(Boolean);
   if(!lines.length||lines.every(x=>x.length<2))return fail(ack,'Write at least one slogan!');
   r.slogans.set(socket.id,lines);ack?.({ok:true});
   if(r.slogans.size>=r.players.size)makeShirts(r);else{progress(r);ns.to(socket.id).emit('task',taskFor(r,socket.id))}
  });
  socket.on('vote',(data,ack)=>{
   const r=get(socket);
   if(!r||r.stage!=='duel'||!r.players.has(socket.id))return fail(ack,'Voting is not open.');
   if(!r.eligible.includes(socket.id))return fail(ack,'You cannot vote in your own match.');
   if(r.votes.has(socket.id))return fail(ack,'You already voted!');
   const winner=data?.id;
   if(winner!==r.duel.left&&winner!==r.duel.right)return fail(ack,'Pick one of the two shirts.');
   r.votes.set(socket.id,winner);ack?.({ok:true});
   if(r.eligible.every(id=>r.votes.has(id)))resolveDuel(r);
   else{progress(r);ns.to(socket.id).emit('task',taskFor(r,socket.id))}
  });
  socket.on('skip',(_,ack)=>{
   const r=get(socket);
   if(!r||r.host!==socket.id)return fail(ack,'Only the host can skip.');
   if(r.stage==='drawing')beginSlogans(r);
   else if(r.stage==='slogans')makeShirts(r);
   else if(r.stage==='duel')resolveDuel(r);
   else if(r.stage==='reveal'){stop(r);afterReveal(r)}
   else return fail(ack,'No active phase to skip.');
   ack?.({ok:true});
  });
  socket.on('disconnect',()=>leave(socket));
 });
}
