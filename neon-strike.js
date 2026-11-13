import {randomBytes} from 'node:crypto';

// NEON STRIKE: original, server-authoritative, three-a-side arcade football.
// Room state is in RAM; no account or database required. The server simulates
// players, goalkeeper bots, the ball, walls, goals, and each match at 30Hz.
const FIELD_X=20.5,FIELD_Z=32,GOAL_W=6.3,GOAL_H=3.35,STEP=1/30;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const vec=(a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;return {x:dx/len,z:dz/len,d:len}};
const angle=(x,z)=>Math.atan2(x,z);
const clean=x=>String(x||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,22)||'Player';
const clock=()=>Date.now();
const pack=p=>({
 id:p.id,name:p.name,team:p.team,slot:p.slot,bot:p.bot,
 x:Math.round(p.x*100)/100,z:Math.round(p.z*100)/100,yaw:Math.round(p.yaw*1000)/1000,
 vx:Math.round(p.vx*100)/100,vz:Math.round(p.vz*100)/100,
 stamina:Math.round(p.stamina),tackling:p.slide>0,hasBall:false
});
const pos=(team,slot)=>{
 const z=team===0?1:-1;
 return slot===2?{x:0,z:26*z}:slot===0?{x:-5*z,z:10*z}:{x:5*z,z:15*z};
};
function makePlayer(id,name,team,slot,bot=false){
 const p=pos(team,slot);
 return {id,name,team,slot,bot,x:p.x,z:p.z,vx:0,vz:0,yaw:team===0?Math.PI:0,
 stamina:100,slide:0,slideCooldown:0,kickCooldown:0,actionCooldown:0,botCooldown:0,
 input:{forward:0,strafe:0,sprint:false,yaw:team===0?Math.PI:0,pitch:0},touchedAt:0};
}
export function attachNeonStrike(io){
 const ns=io.of('/strike'),rooms=new Map(),membership=new Map();
 const code=()=>{let c;do{c=randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(c));return c};
 const member=socket=>rooms.get(membership.get(socket.id));
 const sendAck=(ack,obj)=>{if(typeof ack==='function')ack(obj)};
 const refuse=(ack,error)=>sendAck(ack,{ok:false,error});
 function toLobby(room){
  return {
   code:room.code,phase:room.phase,host:room.host,score:room.score,time:room.time,
   players:[...room.humans.values()].map(p=>({id:p.id,name:p.name,team:p.team,slot:p.slot})),
   options:{bots:true,maxHumans:6},reason:room.reason||''
  };
 }
 const emitLobby=room=>ns.to(room.code).emit('lobby',toLobby(room));
 function spawn(room){
  const list=[];
  for(let team=0;team<2;team++){
   for(let slot=0;slot<3;slot++){
    const human=[...room.humans.values()].find(p=>p.team===team&&p.slot===slot);
    const p=human||makePlayer('BOT-'+room.code+'-'+team+'-'+slot,
     slot===2?'KEEPER':team===0?['NOVA','FLUX'][slot]:['BLAZE','VEX'][slot],team,slot,true);
    const base=pos(team,slot);
    Object.assign(p,{x:base.x,z:base.z,vx:0,vz:0,yaw:team===0?Math.PI:0,stamina:100,
     slide:0,slideCooldown:0,kickCooldown:0,botCooldown:.4+Math.random()*.2});
    list.push(p);
   }
  }
  room.actors=list;
  room.ball={x:0,z:0,y:.42,vx:0,vz:0,vy:0,owner:null,lock:0,lastTouch:null};
  room.pause=2.1;room.nextKickoff=clock()+2100;
 }
 function reset(room){
  room.score=[0,0];room.time=240;room.reason='';room.phase='playing';room.lastTick=clock();
  room.goalEvent=null;room.endCount=0;room.sequence=0;room.winners=null;spawn(room);emitLobby(room);
 }
 const entity=room=>room.actors.find(p=>p.id===room.ball.owner);
 const nearControl=(room,p)=>dist(p,room.ball)<1.6&&room.ball.y<1.48&&room.ball.lock<=0;
 function kick(room,p,power=.6,loft=false,pass=false){
  if(room.phase!=='playing'||room.pause>0||p.kickCooldown>0)return false;
  const ball=room.ball,owner=entity(room);
  if(owner&&owner.id!==p.id)return false;
  if(!owner&&!nearControl(room,p))return false;
  let yaw=p.yaw,pitch=clamp(p.input.pitch||0,-.3,.45);
  if(pass){
   const mates=room.actors.filter(q=>q.team===p.team&&q.id!==p.id);
   mates.sort((a,b)=>{
    const v1=vec(p,a),v2=vec(p,b);
    const d1=Math.cos(angle(v1.x,v1.z)-p.yaw),d2=Math.cos(angle(v2.x,v2.z)-p.yaw);
    return (d2*30-v2.d)-(d1*30-v1.d);
   });
   const target=mates[0];
   if(target)yaw=angle(target.x-p.x,target.z-p.z);
   power=.43;pitch=.08;
  }
  const speed=pass?16:13+16*clamp(power,.15,1);
  const lift=loft?5.5+5*power:pass?1.0:Math.max(.3,1.7+6*clamp(pitch,-.2,.5)+1.1*power);
  ball.owner=null;ball.lock=.43;ball.lastTouch=p.id;
  ball.x=p.x+Math.sin(yaw)*1.05;ball.z=p.z+Math.cos(yaw)*1.05;ball.y=.47;
  ball.vx=Math.sin(yaw)*speed;ball.vz=Math.cos(yaw)*speed;ball.vy=lift;
  p.kickCooldown=.43;p.botCooldown=1;
  ns.to(room.code).emit('fx',{kind:pass?'pass':loft?'lob':'kick',x:ball.x,z:ball.z,team:p.team,power});
  return true;
 }
 function tackle(room,p){
  if(room.phase!=='playing'||room.pause>0||p.slideCooldown>0)return false;
  p.slide=.43;p.slideCooldown=1.65;
  p.vx+=Math.sin(p.yaw)*10;p.vz+=Math.cos(p.yaw)*10;
  const ball=room.ball,owner=entity(room);
  if(owner&&owner.team!==p.team&&dist(owner,p)<2.7){
   ball.owner=p.id;ball.lock=.16;ball.lastTouch=p.id;room.tackleMessage=p.name+' won the ball!';
   ns.to(room.code).emit('fx',{kind:'tackle',x:p.x,z:p.z,team:p.team});
  }else if(!owner&&dist(ball,p)<2.15&&ball.y<1.8){
   ball.owner=p.id;ball.lock=.12;ball.lastTouch=p.id;
   ns.to(room.code).emit('fx',{kind:'tackle',x:p.x,z:p.z,team:p.team});
  }
  return true;
 }
 function takeBall(room,p){
  const b=room.ball;
  b.owner=p.id;b.lock=.24;b.lastTouch=p.id;b.vx=0;b.vz=0;b.vy=0;b.y=.42;
 }
 function goal(room,team){
  room.score[team]++;
  room.goalEvent={team,at:clock(),scorer:room.ball.lastTouch};
  const scorer=room.actors.find(p=>p.id===room.ball.lastTouch);
  ns.to(room.code).emit('fx',{kind:'goal',team,scorer:scorer?.name||'',score:room.score.slice()});
  spawn(room);room.pause=3.5;
 }
 function simulateBall(room,dt){
  const b=room.ball;
  b.lock=Math.max(0,b.lock-dt);
  const holder=entity(room);
  if(holder){
   b.x=holder.x+Math.sin(holder.yaw)*1.18;
   b.z=holder.z+Math.cos(holder.yaw)*1.18;
   b.y=.42+Math.abs(Math.sin(room.sequence*.45))*.055;
   b.vx=holder.vx;b.vz=holder.vz;b.vy=0;
   return;
  }
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;
  b.vy-=18*dt;
  if(b.y<.42){b.y=.42;b.vy=Math.abs(b.vy)*.34;if(Math.abs(b.vy)<.9)b.vy=0;b.vx*=.985;b.vz*=.985}
  else{b.vx*=1-dt*.12;b.vz*=1-dt*.12}
  b.vx*=1-dt*.26;b.vz*=1-dt*.26;
  if(b.x>FIELD_X-.4){b.x=FIELD_X-.4;b.vx=-Math.abs(b.vx)*.76}
  if(b.x< -FIELD_X+.4){b.x=-FIELD_X+.4;b.vx=Math.abs(b.vx)*.76}
  if(b.z < -FIELD_Z+.18){
   if(Math.abs(b.x)<GOAL_W&&b.y<GOAL_H){goal(room,0);return}
   b.z=-FIELD_Z+.18;b.vz=Math.abs(b.vz)*.77;
  }
  if(b.z>FIELD_Z-.18){
   if(Math.abs(b.x)<GOAL_W&&b.y<GOAL_H){goal(room,1);return}
   b.z=FIELD_Z-.18;b.vz=-Math.abs(b.vz)*.77;
  }
  if(b.lock<=0&&b.y<1.3){
   const nearby=room.actors.filter(p=>dist(p,b)<1.35).sort((a,c)=>dist(a,b)-dist(c,b));
   const taker=nearby.find(p=>p.slide<=0);
   if(taker)takeBall(room,taker);
  }
 }
 function applyVelocity(p,desiredX,desiredZ,sprint,dt){
  const strength=Math.hypot(desiredX,desiredZ);
  if(strength>1){desiredX/=strength;desiredZ/=strength}
  const boost=sprint&&p.stamina>5;
  const speed=p.slot===2?7.3:boost?12:8.1;
  const fraction=Math.min(1,12.5*dt);
  const desiredVx=desiredX*speed,desiredVz=desiredZ*speed;
  p.vx+=(desiredVx-p.vx)*fraction;p.vz+=(desiredVz-p.vz)*fraction;
  if(p.slide>0){p.vx*=.985;p.vz*=.985}
  p.x=clamp(p.x+p.vx*dt,-FIELD_X+1.0,FIELD_X-1);
  p.z=clamp(p.z+p.vz*dt,-FIELD_Z+1.1,FIELD_Z-1.1);
  p.stamina=clamp(p.stamina+(boost&&strength>.2?-27:18)*dt,0,100);
  p.slide=Math.max(0,p.slide-dt);p.slideCooldown=Math.max(0,p.slideCooldown-dt);
  p.kickCooldown=Math.max(0,p.kickCooldown-dt);p.botCooldown=Math.max(0,p.botCooldown-dt);
 }
 function stepBot(room,p,dt){
  const b=room.ball,owner=entity(room),own=owner?.id===p.id;
  const team=room.actors.filter(q=>q.team===p.team&&q.slot!==2);
  const chaser=team.slice().sort((a,c)=>dist(a,b)-dist(c,b))[0];
  const attack=p.team===0?-1:1,defend=-attack;
  let target={x:0,z:0};
  if(p.slot===2){
   target={x:clamp(b.x*.56,-5.7,5.7),z:defend*29.1};
   if((defend>0?b.z>16:b.z< -16)&&dist(p,b)<14)
    target={x:clamp(b.x,-6.2,6.2),z:clamp(b.z,-30,30)};
  }else if(own){
   target={x:clamp(b.x*.65,-9,9),z:attack*30};
  }else if(owner&&owner.team===p.team){
   target={x:p.slot===0?-9:9,z:clamp(owner.z+attack*9,-28,28)};
  }else if(chaser?.id===p.id||dist(p,b)<6){
   target={x:b.x,z:b.z};
  }else{
   target={x:p.slot===0?-11:11,z:clamp(b.z+defend*8,-27,27)};
  }
  const v=vec(p,target),towardBall=vec(p,b);
  p.yaw=angle(own?Math.sin(p.yaw)*.65+Math.sin(angle(0,attack))*.35:v.x,
    own?Math.cos(p.yaw)*.65+attack*.35:v.z);
  applyVelocity(p,v.d>1.1?v.x:0,v.d>1.1?v.z:0,p.slot!==2&&v.d>12,dt);
  if(owner&&owner.team!==p.team&&dist(owner,p)<2.3&&p.slideCooldown<=0)tackle(room,p);
  if(!owner&&p.slot===2){
   const attackingGoal=defend*FIELD_Z;
   const inGoalZone=Math.abs(b.z-attackingGoal)<10.5;
   if(inGoalZone&&Math.abs(b.x-p.x)<1.72&&Math.abs(b.z-p.z)<2.4&&b.y<2.85&&b.lock<=.4){
    takeBall(room,p);p.botCooldown=.45;
    ns.to(room.code).emit('fx',{kind:'save',x:p.x,z:p.z,team:p.team});
   }
  }
  if(!owner&&nearControl(room,p))takeBall(room,p);
  if(b.owner===p.id&&p.botCooldown<=0){
   const fromGoal=Math.abs(attack*FIELD_Z-p.z),angleToGoal=Math.abs(p.x);
   if(p.slot===2){kick(room,p,.4,false,true);p.botCooldown=1.4}
   else if(fromGoal<21.5&&angleToGoal<13.5){
    // Aim toward the mouth of the goal with some bot error; close-angle
    // chances are more likely than full-field automatic goals.
    const targetX=(Math.random()-.5)*11.2;
    p.yaw=angle(targetX-p.x,attack*FIELD_Z-p.z);
    kick(room,p,clamp(.55+(22-fromGoal)/70,.51,.79),false,false);
    p.botCooldown=2.2;
   }else if(dist(p,{x:0,z:attack*27})>8&&Math.random()<dt*.52){
    kick(room,p,.4,false,true);p.botCooldown=1.4;
   }
  }
 }
 function simulate(room,dt){
  if(room.phase!=='playing')return;
  if(room.pause>0){
   room.pause=Math.max(0,room.pause-dt);
   if(room.pause===0)room.ball.lock=.15;
   return;
  }
  room.time=Math.max(0,room.time-dt);
  if(room.time<=0){
   room.phase='finished';room.reason=room.score[0]===room.score[1]?'DRAW':room.score[0]>room.score[1]?'CYAN WINS':'CORAL WINS';
   emitLobby(room);return;
  }
  room.sequence++;
  for(const p of room.actors){
   if(p.bot)stepBot(room,p,dt);
   else{
    const input=p.input;
    // Controls are relative to client camera yaw: 'forward' means camera forward.
    p.yaw=input.yaw;
    const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw);
    const dx=fx*input.forward+fz*input.strafe;
    const dz=fz*input.forward-fx*input.strafe;
    applyVelocity(p,dx,dz,Boolean(input.sprint),dt);
   }
  }
  // Keep players solid enough that two actors don't occupy identical positions.
  for(let i=0;i<room.actors.length;i++)for(let j=i+1;j<room.actors.length;j++){
   const a=room.actors[i],b=room.actors[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
   if(d<1.05&&d>.001){const push=(1.05-d)*.48;a.x-=dx/d*push;a.z-=dz/d*push;b.x+=dx/d*push;b.z+=dz/d*push}
  }
  simulateBall(room,dt);
 }
 function snapshot(room){
  const holder=entity(room);
  return {
   phase:room.phase,seq:room.sequence,score:room.score,time:room.time,
   pause:room.pause,reason:room.reason,
   ball:{x:room.ball.x,y:room.ball.y,z:room.ball.z,vx:room.ball.vx,vy:room.ball.vy,vz:room.ball.vz,owner:room.ball.owner},
   players:room.actors.map(p=>({...pack(p),hasBall:holder?.id===p.id}))
  };
 }
 let ticks=0;
 const simTimer=setInterval(()=>{
  ticks++;for(const room of rooms.values()){
   if(room.phase!=='playing')continue;
   simulate(room,STEP);
   if(ticks%3===0)ns.to(room.code).emit('snapshot',snapshot(room));
  }
 },1000/30);
 simTimer.unref?.();
 function leave(socket){
  const roomCode=membership.get(socket.id);
  membership.delete(socket.id);
  if(!roomCode)return;
  const room=rooms.get(roomCode);socket.leave(roomCode);
  if(!room)return;
  room.humans.delete(socket.id);
  if(!room.humans.size){rooms.delete(roomCode);return}
  if(room.host===socket.id)room.host=room.humans.keys().next().value;
  if(room.phase==='playing'){
   // Convert disconnected player into a bot, preserving the current match.
   const at=room.actors.findIndex(p=>p.id===socket.id);
   if(at>=0){const old=room.actors[at],replacement=makePlayer('BOT-'+room.code+'-'+old.team+'-'+old.slot,'SUBSTITUTE',old.team,old.slot,true);
    Object.assign(replacement,{x:old.x,z:old.z,vx:old.vx,vz:old.vz,yaw:old.yaw});
    room.actors[at]=replacement;
    if(room.ball.owner===old.id)room.ball.owner=replacement.id;
   }
  }else if(room.phase==='lobby'){
   for(const p of room.humans.values()){
    const teammates=[...room.humans.values()].filter(q=>q.team===p.team&&q.id!==p.id);
    while(teammates.some(q=>q.slot===p.slot))p.slot=(p.slot+1)%3;
   }
  }
  emitLobby(room);
 }
 ns.on('connection',socket=>{
  socket.on('create',(raw,ack)=>{
   leave(socket);
   const room={code:code(),host:socket.id,humans:new Map(),actors:[],phase:'lobby',
    score:[0,0],time:240,pause:0,ball:{x:0,y:.42,z:0},sequence:0,reason:''};
   const p=makePlayer(socket.id,clean(raw?.name),0,0);
   room.humans.set(socket.id,p);rooms.set(room.code,room);membership.set(socket.id,room.code);
   socket.join(room.code);sendAck(ack,{ok:true,code:room.code,team:0});emitLobby(room);
  });
  socket.on('join',(raw,ack)=>{
   const id=String(raw?.code||'').toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,6);
   const room=rooms.get(id);
   if(!room)return refuse(ack,'Room not found.');
   if(room.phase!=='lobby')return refuse(ack,'This match has already started. Join the next match.');
   if(room.humans.size>=6)return refuse(ack,'This arena is full (six players).');
   leave(socket);
   const counts=[0,1].map(t=>[...room.humans.values()].filter(p=>p.team===t).length);
   const team=counts[0]<=counts[1]?0:1;
   const slots=[0,1,2],occupied=new Set([...room.humans.values()].filter(p=>p.team===team).map(p=>p.slot));
   const free=slots.find(n=>!occupied.has(n));
   const p=makePlayer(socket.id,clean(raw?.name),team,free);
   room.humans.set(socket.id,p);membership.set(socket.id,id);socket.join(id);
   sendAck(ack,{ok:true,code:id,team});emitLobby(room);
  });
  socket.on('team',(value,ack)=>{
   const room=member(socket),p=room?.humans.get(socket.id);
   if(!room||!p||room.phase!=='lobby')return refuse(ack,'Teams can only change in the lobby.');
   const team=Number(value);
   if(team!==0&&team!==1)return refuse(ack,'Invalid team');
   const used=new Set([...room.humans.values()].filter(q=>q.id!==p.id&&q.team===team).map(q=>q.slot));
   const slot=[0,1,2].find(n=>!used.has(n));
   if(slot===undefined)return refuse(ack,'That team already has three players');
   p.team=team;p.slot=slot;p.yaw=team===0?Math.PI:0;
   sendAck(ack,{ok:true,team});emitLobby(room);
  });
  socket.on('start',(_,ack)=>{
   const room=member(socket);
   if(!room||room.host!==socket.id)return refuse(ack,'Only the host can start.');
   if(room.phase!=='lobby'&&room.phase!=='finished')return refuse(ack,'A match is already underway.');
   reset(room);sendAck(ack,{ok:true});
   ns.to(room.code).emit('snapshot',snapshot(room));
  });
  socket.on('input',value=>{
   const room=member(socket),p=room?.humans.get(socket.id);
   if(!room||room.phase!=='playing'||!p||!value||typeof value!=='object')return;
   const input=p.input;
   input.forward=clamp(Number(value.forward)||0,-1,1);
   input.strafe=clamp(Number(value.strafe)||0,-1,1);
   input.sprint=value.sprint===true;
   input.yaw=Number.isFinite(value.yaw)?clamp(value.yaw,-100000,100000):input.yaw;
   input.pitch=Number.isFinite(value.pitch)?clamp(value.pitch,-.3,.45):0;
  });
  socket.on('action',(value,ack)=>{
   const room=member(socket),p=room?.humans.get(socket.id);
   if(!room||room.phase!=='playing'||!p)return refuse(ack,'No active match.');
   const kind=String(value?.type||'');
   let success=false;
   if(kind==='shoot')success=kick(room,p,Number(value.power)||.6,false,false);
   else if(kind==='lob')success=kick(room,p,Number(value.power)||.65,true,false);
   else if(kind==='pass')success=kick(room,p,.5,false,true);
   else if(kind==='tackle')success=tackle(room,p);
   else if(kind==='call'){
    const teammate=room.actors.filter(q=>q.bot&&q.team===p.team&&q.id===room.ball.owner)[0];
    if(teammate){teammate.yaw=angle(p.x-teammate.x,p.z-teammate.z);success=kick(room,teammate,.44,false,true)}
   }
   sendAck(ack,{ok:success});
  });
  socket.on('leave',(_,ack)=>{leave(socket);socket.emit('lobby',null);sendAck(ack,{ok:true})});
  socket.on('disconnect',()=>leave(socket));
 });
 // Test-only pure hooks are returned so simulation and match rules can be checked
 // without launching a browser or binding a real network port.
 return {rooms,simulate,spawn,reset,goal,kick,tackle,snapshot};
}
