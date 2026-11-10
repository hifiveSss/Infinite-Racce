import {randomBytes} from 'node:crypto';
export function attachContextCrash(io){
 const ns=io.of('/context'),rooms=new Map(),members=new Map();
 const prompts=["What would you say about an unexpectedly amazing breakfast?","Describe a completely perfect weekend.","What makes a great birthday present?","How would you describe the most comfortable chair?","What's a surprisingly fun way to spend a rainy afternoon?","What is the best way to celebrate good news?","Describe a clever invention in one sentence.","How would you review a genuinely brilliant book?","What's something you wish existed everywhere?","What makes a party worth attending?","What would you say about your dream holiday?","Describe something you absolutely love about a pet.","What's the best thing about your favourite hobby?","How would you describe a really friendly neighbour?","What's something you'd gladly do every day?","Describe a perfect day at the beach.","How would you describe an excellent meal?","What makes a great movie unforgettable?","Describe a very successful surprise.","How would you describe the ideal first day of holidays?","What's the most underrated way to have fun?","What would you say about a fantastic school excursion?","Describe the perfect way to spend a free afternoon.","What makes a concert truly special?","How would you describe a really good sports team?","What's something you could talk about for hours?","What makes a good app worth downloading?","Describe an unexpectedly useful gift.","What would you say about a wonderful place to live?","What would you say about an impressive science experiment?","Describe a great theme park ride.","What makes a funny joke truly funny?","How would you describe a stunning sunset?","What's the best part of visiting friends?","Describe what makes an ideal restaurant.","What do you like about a good mystery?","What would you say about a dream car?","Describe a game that's surprisingly addictive.","What makes a picnic worth having?","Describe a truly relaxing spa day.","How would you describe a great pair of shoes?","What's a hobby you would recommend to anyone?","Describe the world's best playground.","What's the most pleasant sound you can think of?","Describe the ultimate birthday cake.","What do you like most about a cool new gadget?","How would you review an incredible hotel?","What makes a pet animal unusually clever?","What's an amazing way to spend a long weekend?","Describe your most enjoyable kind of competition."];
 const modes=[{"name":"VIRAL HEADLINE","icon":"📰","instructions":"Write an outrageous article headline this quote could appear under."},{"name":"BAD PRODUCT","icon":"🛒","instructions":"Name the wildly inappropriate product that received this review."},{"name":"FORUM THREAD","icon":"💬","instructions":"Write the terrible internet forum question that this quote appears to answer."},{"name":"OFFICIAL NOTICE","icon":"📢","instructions":"Write a ludicrous official announcement this quote would look bad beneath."},{"name":"AD CAMPAIGN","icon":"📺","instructions":"Write the name or slogan of an awful advertisement associated with this quote."}];
 const text=(x,n=130)=>String(x||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
 const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
 const newCode=()=>{let c;do{c=randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(c));return c};
 const fail=(ack,msg)=>ack?.({ok:false,error:msg});
 const get=s=>rooms.get(members.get(s.id));
 const stop=r=>{if(r.timer)clearTimeout(r.timer);r.timer=null};
 const timer=(r,ms,fn)=>{stop(r);r.endsAt=Date.now()+ms;r.timer=setTimeout(()=>{r.timer=null;fn(r)},ms)};
 function state(r){return {code:r.code,host:r.host,stage:r.stage,round:r.round,total:r.total,
  endsAt:r.endsAt,mode:r.mode?.name||'',modeIcon:r.mode?.icon||'',players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score})).sort((a,b)=>b.score-a.score),
  done:r.stage==='writing'?r.answers.size:r.stage==='twisting'?r.twists.size:r.stage==='voting'?r.votes.size:0,
  posts:r.stage==='voting'?r.posts.map(p=>({id:p.id,headline:p.headline,quote:p.quote})):[],
  reveal:r.stage==='reveal'?r.reveal:null,winners:r.stage==='finished'?r.winners:[]}}
 function send(r){
  ns.to(r.code).emit('state',state(r));
  for(const id of r.players.keys()){
   let task={stage:r.stage,round:r.round,already:false};
   if(r.stage==='writing')task={...task,prompt:r.prompts.get(id),already:r.answers.has(id)};
   if(r.stage==='twisting'){const target=r.targets.get(id);task={...task,quote:target?.quote||'',instructions:r.mode.instructions,already:r.twists.has(id)}}
   if(r.stage==='voting')task={...task,own:r.posts.find(p=>p.writer===id)?.id||null,already:r.votes.has(id)};
   ns.to(id).emit('task',task);
  }
 }
 function finish(r){
  stop(r);r.endsAt=null;r.stage='finished';const high=Math.max(0,...[...r.players.values()].map(p=>p.score));
  r.winners=[...r.players.values()].filter(p=>p.score===high).map(p=>p.id);send(r)
 }
 function begin(r){
  if(r.players.size<3){finish(r);return}
  r.stage='writing';r.mode=modes[(r.round-1)%modes.length];
  r.answers=new Map();r.targets=new Map();r.twists=new Map();r.votes=new Map();r.posts=[];r.reveal=null;
  const all=shuffle(prompts),ids=shuffle([...r.players.keys()]);
  r.prompts=new Map(ids.map((id,i)=>[id,all[(r.round*ids.length+i)%all.length]]));
  timer(r,65000,twisting);send(r)
 }
 function twisting(r){
  if(r.stage!=='writing')return;
  const ids=shuffle([...r.players.keys()]);r.targets=new Map();
  for(let i=0;i<ids.length;i++){
   const author=ids[(i+1)%ids.length];
   r.targets.set(ids[i],{author,quote:r.answers.get(author)||'That sounds pretty amazing, honestly.',originalPrompt:r.prompts.get(author)||''});
  }
  r.stage='twisting';timer(r,65000,voting);send(r)
 }
 function voting(r){
  if(r.stage!=='twisting')return;
  r.stage='voting';r.votes=new Map();
  r.posts=shuffle([...r.players.keys()].map(id=>{
   const t=r.targets.get(id);
   return {id:'post-'+randomBytes(5).toString('hex'),writer:id,victim:t.author,quote:t.quote,originalPrompt:t.originalPrompt,
    headline:r.twists.get(id)||'The most unbelievable announcement of the year.',mode:r.mode.name};
  }));
  timer(r,45000,reveal);send(r)
 }
 function reveal(r){
  if(r.stage!=='voting')return;
  r.stage='reveal';const mult=r.round===r.total?2:1;
  const gains=new Map([...r.players.keys()].map(id=>[id,0]));
  const results=r.posts.map(p=>{
   const voters=[...r.votes].filter(([,choice])=>choice===p.id).map(([id])=>id);
   if(r.twists.has(p.writer))gains.set(p.writer,gains.get(p.writer)+voters.length*1000*mult);
   if(r.answers.has(p.victim))gains.set(p.victim,gains.get(p.victim)+voters.length*200*mult);
   return {headline:p.headline,quote:p.quote,mode:p.mode,originalPrompt:p.originalPrompt,
    writer:r.players.get(p.writer)?.name||'Unknown',quoted:r.players.get(p.victim)?.name||'Unknown',
    votes:voters.length,voters:voters.map(id=>r.players.get(id)?.name||'Player')};
  }).sort((a,b)=>b.votes-a.votes);
  for(const [id,amount] of gains){const p=r.players.get(id);if(p)p.score+=amount}
  r.reveal={results,gains:[...gains].map(([id,points])=>({id,points})),multiplier:mult};
  timer(r,15000,advance);send(r)
 }
 function advance(r){if(r.stage!=='reveal')return;if(r.round>=r.total)finish(r);else{r.round++;begin(r)}}
 function leave(socket){
  const code=members.get(socket.id);members.delete(socket.id);if(!code)return;
  socket.leave(code);const r=rooms.get(code);if(!r)return;
  r.players.delete(socket.id);r.answers.delete(socket.id);r.twists.delete(socket.id);r.votes.delete(socket.id);
  if(!r.players.size){stop(r);rooms.delete(code);return}
  if(r.host===socket.id)r.host=r.players.keys().next().value;
  if(!['lobby','finished'].includes(r.stage)&&r.players.size<3){finish(r);return}
  if(r.stage==='writing'&&r.answers.size===r.players.size)twisting(r);
  else if(r.stage==='twisting'&&r.twists.size===r.players.size)voting(r);
  else if(r.stage==='voting'&&r.votes.size===r.players.size)reveal(r);
  else send(r);
 }
 ns.on('connection',socket=>{
  socket.on('create',(data,ack)=>{
   leave(socket);const code=newCode(),name=text(data?.name,22)||'Player';
   const r={code,host:socket.id,stage:'lobby',players:new Map(),round:0,total:4,mode:null,endsAt:null,timer:null,
    prompts:new Map(),answers:new Map(),targets:new Map(),twists:new Map(),votes:new Map(),posts:[],reveal:null,winners:[]};
   r.players.set(socket.id,{id:socket.id,name,score:0});rooms.set(code,r);members.set(socket.id,code);socket.join(code);
   ack?.({ok:true,code});send(r);
  });
  socket.on('join',(data,ack)=>{
   const code=text(data?.code,6).toUpperCase(),r=rooms.get(code);
   if(!r)return fail(ack,'Room not found.');
   if(!['lobby','finished'].includes(r.stage))return fail(ack,'Game already running. Join the next one.');
   if(r.players.size>=12)return fail(ack,'This room is full (12 max).');
   leave(socket);r.players.set(socket.id,{id:socket.id,name:text(data?.name,22)||'Player',score:0});
   members.set(socket.id,code);socket.join(code);ack?.({ok:true,code});send(r);
  });
  socket.on('leave',(_,ack)=>{leave(socket);socket.emit('state',null);ack?.({ok:true})});
  socket.on('start',(data,ack)=>{
   const r=get(socket);
   if(!r||r.host!==socket.id)return fail(ack,'Only the host can start.');
   if(!['lobby','finished'].includes(r.stage))return fail(ack,'A game is already running.');
   if(r.players.size<3)return fail(ack,'You need at least three players.');
   r.round=1;r.total=Math.max(3,Math.min(7,Number(data?.rounds)||4));r.winners=[];
   for(const p of r.players.values())p.score=0;
   begin(r);ack?.({ok:true});
  });
  socket.on('answer',(data,ack)=>{
   const r=get(socket);if(!r||r.stage!=='writing')return fail(ack,'Writing has ended.');
   if(r.answers.has(socket.id))return fail(ack,'You already answered.');
   const v=text(data?.text,110);if(v.length<3)return fail(ack,'Write a slightly longer answer.');
   r.answers.set(socket.id,v);ack?.({ok:true});
   if(r.answers.size===r.players.size)twisting(r);else send(r);
  });
  socket.on('twist',(data,ack)=>{
   const r=get(socket);if(!r||r.stage!=='twisting')return fail(ack,'Twisting has ended.');
   if(r.twists.has(socket.id))return fail(ack,'You already submitted.');
   const v=text(data?.text,130);if(v.length<4)return fail(ack,'Write a little more context.');
   r.twists.set(socket.id,v);ack?.({ok:true});
   if(r.twists.size===r.players.size)voting(r);else send(r);
  });
  socket.on('vote',(data,ack)=>{
   const r=get(socket);if(!r||r.stage!=='voting')return fail(ack,'Voting has ended.');
   if(r.votes.has(socket.id))return fail(ack,'Already voted.');
   const p=r.posts.find(p=>p.id===data?.id);
   if(!p)return fail(ack,'No such post.');
   if(p.writer===socket.id)return fail(ack,'You cannot vote for your own post.');
   r.votes.set(socket.id,p.id);ack?.({ok:true});
   if(r.votes.size===r.players.size)reveal(r);else send(r);
  });
  socket.on('skip',(_,ack)=>{
   const r=get(socket);if(!r||r.host!==socket.id)return fail(ack,'Only the host can advance.');
   if(r.stage==='writing')twisting(r);else if(r.stage==='twisting')voting(r);
   else if(r.stage==='voting')reveal(r);else if(r.stage==='reveal'){stop(r);advance(r)}
   else return fail(ack,'Nothing to advance.');
   ack?.({ok:true});
  });
  socket.on('disconnect',()=>leave(socket));
 });
}
