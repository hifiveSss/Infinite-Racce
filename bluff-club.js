// A self-contained room-code party game. No external AI or database required.
export function attachBluffClub(io){
 const nsp=io.of('/bluff');
 const rooms=new Map();
 const clients=new Map();
 const deck=[{"question":"What was Play-Doh originally sold as?","answer":"Wallpaper cleaner","decoys":["Shoe polish","Hair gel","Window putty"]},{"question":"What was Bubble Wrap originally invented to be?","answer":"Textured wallpaper","decoys":["Shoe insulation","Greenhouse roofing","Raincoats"]},{"question":"What was Google's early research project called?","answer":"BackRub","decoys":["Googolplex","PageWeb","SearchDog"]},{"question":"What was the first computer mouse prototype largely made of?","answer":"Wood","decoys":["Cardboard","Glass","Bakelite"]},{"question":"Which country has more ancient pyramids than Egypt?","answer":"Sudan","decoys":["Mexico","Peru","Greece"]},{"question":"What is Scotland's national animal?","answer":"Unicorn","decoys":["Highland cow","Golden eagle","Red deer"]},{"question":"What shape are wombat droppings?","answer":"Cubes","decoys":["Stars","Spirals","Triangles"]},{"question":"What is the dot above a lowercase i called?","answer":"Tittle","decoys":["Jot","Pixel","Glyph"]},{"question":"What colour is an aircraft's black box recorder?","answer":"Orange","decoys":["Black","Yellow","Silver"]},{"question":"What is the smell after rain called?","answer":"Petrichor","decoys":["Nebulon","Geoscent","Rainfall"]},{"question":"Which animal has three hearts?","answer":"Octopus","decoys":["Dolphin","Sea turtle","Jellyfish"]},{"question":"Which fruit has its seeds on the outside?","answer":"Strawberry","decoys":["Peach","Kiwi","Pear"]},{"question":"Which animal's fingerprints resemble human fingerprints?","answer":"Koala","decoys":["Lemur","Sloth","Otter"]},{"question":"Which animal is commonly called a sea bunny?","answer":"Sea slug","decoys":["Tiny seal","Sea cucumber","Pufferfish"]},{"question":"What is a group of flamingos called?","answer":"Flamboyance","decoys":["Parade","Carnival","Festival"]},{"question":"What is a group of crows called?","answer":"Murder","decoys":["Shadow","Flockery","Council"]},{"question":"What is a group of owls called?","answer":"Parliament","decoys":["Senate","Court","Library"]},{"question":"What is a group of jellyfish called?","answer":"Smack","decoys":["Wobble","Driftwood","Clump"]},{"question":"What was Nintendo originally known for making?","answer":"Playing cards","decoys":["Toy trains","Watches","Board games"]},{"question":"What food did the Aztecs use as money?","answer":"Cacao beans","decoys":["Chilli peppers","Corn kernels","Avocados"]},{"question":"Which board game evolved from The Landlord's Game?","answer":"Monopoly","decoys":["Risk","Cluedo","Life"]},{"question":"Which bird can fly backwards?","answer":"Hummingbird","decoys":["Kingfisher","Swallow","Heron"]},{"question":"What colour is the Sun actually when viewed from space?","answer":"White","decoys":["Orange","Yellow","Blue"]},{"question":"Which planet has the tallest known volcano in the Solar System?","answer":"Mars","decoys":["Venus","Jupiter","Mercury"]},{"question":"What is that giant volcano on Mars called?","answer":"Olympus Mons","decoys":["Mount Titan","Valles Peak","Ares Prime"]},{"question":"What was the first home microwave oven line called?","answer":"Radarange","decoys":["Heatatron","QuickWave","Zapmaster"]},{"question":"What was the tiny extra pocket on jeans originally designed for?","answer":"Pocket watch","decoys":["Coins","Matches","Keys"]},{"question":"What is the only letter not used in any US state name?","answer":"Q","decoys":["X","Z","J"]},{"question":"What does karaoke literally mean in Japanese?","answer":"Empty orchestra","decoys":["Singing alone","Loud room","Music box"]},{"question":"Which mammal lays eggs and has a duck-like bill?","answer":"Platypus","decoys":["Otter","Beaver","Echidna"]},{"question":"What is a baby echidna called?","answer":"Puggle","decoys":["Nugget","Quilllet","Hatchling"]},{"question":"What is a group of dolphins called?","answer":"Pod","decoys":["Band","Schoolhouse","Cluster"]},{"question":"Which country is famous for a flag featuring a dragon?","answer":"Bhutan","decoys":["Nepal","Laos","Mongolia"]},{"question":"Which country has a city called Batman?","answer":"Turkey","decoys":["Norway","Canada","Australia"]},{"question":"What invention was inspired by burrs sticking to clothes?","answer":"Velcro","decoys":["Zippers","Safety pins","Plastic wrap"]},{"question":"Which animal can survive the vacuum of space for a short time?","answer":"Tardigrade","decoys":["Mantis shrimp","Sea urchin","Naked mole rat"]},{"question":"Which fruit is botanically a berry?","answer":"Banana","decoys":["Strawberry","Raspberry","Blackberry"]},{"question":"Which animal has rectangular pupils?","answer":"Goat","decoys":["Eagle","Rabbit","Mouse"]},{"question":"What is the smallest ocean on Earth?","answer":"Arctic Ocean","decoys":["Indian Ocean","Southern Ocean","Atlantic Ocean"]},{"question":"What word describes the feeling astronauts report after seeing Earth from space?","answer":"Overview effect","decoys":["Planet shock","Blue shift","Space euphoria"]},{"question":"What is a mirror-writing word or phrase that reads the same backward?","answer":"Palindrome","decoys":["Alliteration","Anagram","Portmanteau"]},{"question":"Which European city has a Museum of Broken Relationships?","answer":"Zagreb","decoys":["Paris","Rome","Vienna"]},{"question":"What nickname did the first practical chainsaws get because of their medical use?","answer":"Bone saws","decoys":["Doctor blades","Surgical wheels","Hand razors"]},{"question":"What is an animal's ability to grow back a lost limb called?","answer":"Regeneration","decoys":["Reincarnation","Duplication","Metamorphosis"]},{"question":"What kind of animal is the aptly named blue dragon found at sea?","answer":"Sea slug","decoys":["Flying fish","Jellyfish","Sea snake"]},{"question":"What word means a recognizable pattern of stars that's not necessarily a constellation?","answer":"Asterism","decoys":["Galaxy","Nebula","Orbit"]},{"question":"Which Australian river is generally recognized as the country's longest?","answer":"Murray River","decoys":["Darling River","Fitzroy River","Murrumbidgee River"]},{"question":"Which sea animal's blood is famously blue?","answer":"Horseshoe crab","decoys":["Starfish","Clownfish","Sea horse"]},{"question":"What is the art of folding paper into shapes called?","answer":"Origami","decoys":["Kirigami","Ikebana","Washi"]},{"question":"Which animal can change from male to female in a breeding group?","answer":"Clownfish","decoys":["Seahorse","Tuna","Salmon"]},{"question":"Which animal produces the world's most expensive coffee through digestion?","answer":"Civet","decoys":["Panda","Llama","Capybara"]},{"question":"Which ancient Greek device is often described as an early analog computer?","answer":"Antikythera mechanism","decoys":["Archimedes engine","Delphi wheel","Apollo clock"]},{"question":"What does the acronym GIF stand for?","answer":"Graphics Interchange Format","decoys":["Graphical Image File","General Internet Frame","Graphic Input Function"]},{"question":"Which language gives us the word 'robot'?","answer":"Czech","decoys":["German","Greek","Latin"]},{"question":"Which ocean is the Bermuda Triangle in?","answer":"Atlantic Ocean","decoys":["Pacific Ocean","Indian Ocean","Arctic Ocean"]},{"question":"Which musical instrument is associated with the longest recorded sound from a natural material?","answer":"Didgeridoo","decoys":["Harp","Ocarina","Kalimba"]},{"question":"What is the world's largest desert?","answer":"Antarctica","decoys":["Sahara","Gobi Desert","Arabian Desert"]},{"question":"What is the world's largest living lizard?","answer":"Komodo dragon","decoys":["Iguana","Monitor gecko","Gila monster"]},{"question":"What name is given to a miniature tree grown in a pot?","answer":"Bonsai","decoys":["Topiary","Terrarium","Ikebana"]},{"question":"What are the bright lights in the sky near Earth's magnetic poles called?","answer":"Aurora","decoys":["Zodiac lights","Meteor shower","Comet tail"]}];
 const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const clean=(value,max=90)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
 const shuffle=list=>{const output=list.slice();for(let i=output.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[output[i],output[j]]=[output[j],output[i]]}return output};
 const code=()=>{let result;do{result=Math.random().toString(36).slice(2,8).toUpperCase()}while(rooms.has(result));return result};
 const playerInfo=(room,p)=>({id:p.id,name:p.name,score:p.score,ready:room.stage==='writing'?room.bluffs.has(p.id):room.stage==='voting'?room.votes.has(p.id):false});
 function status(room){
  return {
   code:room.code,host:room.host,stage:room.stage,round:room.index+1,totalRounds:room.total,
   prompt:room.stage==='lobby'||room.stage==='finished'?null:room.question?.question||null,
   endsAt:room.endsAt,players:[...room.players.values()].map(p=>playerInfo(room,p)).sort((a,b)=>b.score-a.score),
   submissions:room.bluffs.size,votes:room.votes.size,
   choices:room.stage==='voting'?room.choices.map(o=>({id:o.id,text:o.text})):[],
   reveal:room.stage==='reveal'?room.reveal:null,
   winners:room.stage==='finished'?room.winners:[],
   deckSize:deck.length
  };
 }
 function send(room){nsp.to(room.code).emit('state',status(room))}
 function stopTimer(room){if(room.timer){clearTimeout(room.timer);room.timer=null}}
 function schedule(room,ms,fn){stopTimer(room);room.endsAt=Date.now()+ms;room.timer=setTimeout(()=>{room.timer=null;fn()},ms)}
 function choose(room){
  const left=deck.map((_,i)=>i).filter(i=>!room.used.has(i));
  if(!left.length)room.used.clear();
  const pool=left.length?left:deck.map((_,i)=>i);
  const id=pool[Math.floor(Math.random()*pool.length)];
  room.used.add(id);return deck[id];
 }
 function startWriting(room){
  room.stage='writing';room.question=choose(room);room.bluffs=new Map();room.votes=new Map();
  room.choices=[];room.reveal=null;
  schedule(room,65000,()=>startVoting(room));
  send(room);
 }
 function startVoting(room){
  if(room.stage!=='writing')return;
  room.stage='voting';
  const answers=new Map();
  const truth=normalize(room.question.answer);
  for(const [id,text] of room.bluffs){
   const key=normalize(text);
   if(!key||key===truth)continue;
   if(!answers.has(key))answers.set(key,{text,authors:[]});
   answers.get(key).authors.push(id);
  }
  const options=[{id:'truth',text:room.question.answer,authors:[],truth:true}];
  for(const item of answers.values())options.push({id:'answer'+options.length,text:item.text,authors:item.authors,truth:false});
  const decoys=shuffle(room.question.decoys).filter(x=>!answers.has(normalize(x))&&normalize(x)!==truth);
  let added=0;
  for(const wrong of decoys){
   if(options.length>=Math.max(4,room.players.size+1)||added>=3)break;
   options.push({id:'decoy'+added,text:wrong,authors:[],truth:false});added++;
  }
  room.choices=shuffle(options);
  schedule(room,38000,()=>finishVoting(room));
  send(room);
 }
 function finishVoting(room){
  if(room.stage!=='voting')return;
  room.stage='reveal';
  const gains=new Map([...room.players.keys()].map(id=>[id,0]));
  const breakdown=room.choices.map(option=>{
   const voters=[...room.votes].filter(([,id])=>id===option.id).map(([id])=>id);
   if(option.truth){for(const id of voters)gains.set(id,(gains.get(id)||0)+1000)}
   else if(option.authors.length){
    for(const id of voters)for(const author of option.authors){
     if(author===id)continue;
     gains.set(author,(gains.get(author)||0)+Math.floor(500/option.authors.length));
    }
   }
   return {id:option.id,text:option.text,truth:option.truth,authors:option.authors.map(id=>room.players.get(id)?.name||'Player'),voters:voters.map(id=>room.players.get(id)?.name||'Player'),votes:voters.length};
  });
  for(const [id,gain] of gains){const p=room.players.get(id);if(p)p.score+=gain}
  room.reveal={answer:room.question.answer,explanation:'The real answer was '+room.question.answer+'.',choices:breakdown,gains:[...gains].map(([id,points])=>({id,name:room.players.get(id)?.name||'Player',points}))};
  schedule(room,13500,()=>next(room));send(room);
 }
 function finishGame(room){
  room.stage='finished';room.endsAt=null;room.question=null;
  const top=Math.max(...[...room.players.values()].map(p=>p.score),0);
  room.winners=[...room.players.values()].filter(p=>p.score===top).map(p=>p.id);
  send(room);
 }
 function next(room){
  if(room.stage!=='reveal')return;
  room.index++;
  if(room.index>=room.total)finishGame(room);
  else startWriting(room);
 }
 function leave(socket){
  const current=clients.get(socket.id);
  clients.delete(socket.id);
  if(!current)return;
  socket.leave(current);
  const room=rooms.get(current);
  if(!room)return;
  room.players.delete(socket.id);room.bluffs.delete(socket.id);room.votes.delete(socket.id);
  if(!room.players.size){stopTimer(room);rooms.delete(room.code);return}
  if(room.host===socket.id)room.host=room.players.keys().next().value;
  if(room.stage==='writing'&&room.bluffs.size===room.players.size)startVoting(room);
  else if(room.stage==='voting'&&room.votes.size===room.players.size)finishVoting(room);
  else send(room);
 }
 const error=(ack,message)=>ack?.({ok:false,error:message});
 nsp.on('connection',socket=>{
  socket.on('create',(raw,ack)=>{
   leave(socket);
   const name=clean(raw?.name,22)||'Player';
   const room={code:code(),host:socket.id,players:new Map(),stage:'lobby',index:0,total:6,used:new Set(),timer:null,endsAt:null,question:null,bluffs:new Map(),votes:new Map(),choices:[],reveal:null,winners:[]};
   room.players.set(socket.id,{id:socket.id,name,score:0});rooms.set(room.code,room);
   clients.set(socket.id,room.code);socket.join(room.code);
   ack?.({ok:true,code:room.code});send(room);
  });
  socket.on('join',(raw,ack)=>{
   const key=clean(raw?.code,6).toUpperCase(),room=rooms.get(key);
   if(!room)return error(ack,'Room not found. Double-check the code.');
   if(room.stage!=='lobby'&&room.stage!=='finished')return error(ack,'That game has already started. Join the next one!');
   if(room.players.size>=12)return error(ack,'This room is full (12 players maximum).');
   leave(socket);
   const name=clean(raw?.name,22)||'Player';
   room.players.set(socket.id,{id:socket.id,name,score:0});clients.set(socket.id,key);socket.join(key);
   ack?.({ok:true,code:key});send(room);
  });
  socket.on('leave',(_,ack)=>{leave(socket);socket.emit('state',null);ack?.({ok:true})});
  socket.on('start',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.host!==socket.id)return error(ack,'Only the host can start.');
   if(!['lobby','finished'].includes(room.stage))return error(ack,'Game already running.');
   if(room.players.size<2)return error(ack,'You need at least two players.');
   room.total=Math.max(3,Math.min(10,Number(data?.rounds)||6));
   room.index=0;room.winners=[];room.used=new Set();
   for(const p of room.players.values())p.score=0;
   startWriting(room);ack?.({ok:true});
  });
  socket.on('bluff',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.stage!=='writing'||!room.players.has(socket.id))return error(ack,'The writing round is closed.');
   const answer=clean(data?.text,72);
   if(answer.length<2)return error(ack,'Write a convincing answer (at least 2 characters).');
   if(room.bluffs.has(socket.id))return error(ack,'You already submitted your bluff.');
   room.bluffs.set(socket.id,answer);ack?.({ok:true});
   if(room.bluffs.size===room.players.size)startVoting(room);else send(room);
  });
  socket.on('vote',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.stage!=='voting'||!room.players.has(socket.id))return error(ack,'Voting is closed.');
   if(room.votes.has(socket.id))return error(ack,'You already voted.');
   const choice=room.choices.find(c=>c.id===data?.id);
   if(!choice)return error(ack,'That answer is not an option.');
   if(choice.authors.includes(socket.id))return error(ack,'You cannot vote for your own bluff!');
   room.votes.set(socket.id,choice.id);ack?.({ok:true});
   if(room.votes.size===room.players.size)finishVoting(room);else send(room);
  });
  socket.on('skip',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.host!==socket.id)return error(ack,'Only the host can advance rounds.');
   if(room.stage==='writing')startVoting(room);
   else if(room.stage==='voting')finishVoting(room);
   else if(room.stage==='reveal'){stopTimer(room);next(room)}
   else return error(ack,'Nothing to advance right now.');
   ack?.({ok:true});
  });
  socket.on('disconnect',()=>leave(socket));
 });
}
