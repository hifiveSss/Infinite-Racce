import test from 'node:test';
import assert from 'node:assert/strict';
import {attachNeonStrike} from '../neon-strike.js';

function harness(){
 let accept;
 const messages=[];
 const namespace={
  on(event,handler){if(event==='connection')accept=handler},
  to(id){return{emit(event,data){messages.push({id,event,data})}}}
 };
 const game=attachNeonStrike({of(name){assert.equal(name,'/strike');return namespace}});
 function player(id){
  const listeners={},socket={
   id,join(){},leave(){},emit(){},
   on(event,cb){listeners[event]=cb}
  };
  accept(socket);
  return{
   id,
   async send(event,payload={}){return new Promise(resolve=>listeners[event](payload,resolve))},
   input(value){listeners.input(value)}
  };
 }
 return{game,messages,player};
}
test('friends join one 3v3 match; bots fill empty slots; host permissions',async()=>{
 const h=harness(),a=h.player('host'),b=h.player('friend'),c=h.player('friend2');
 const created=await a.send('create',{name:'A'});
 assert.equal(created.ok,true);
 const code=created.code;assert.equal(code.length,6);
 assert.equal((await b.send('join',{code,name:'B'})).ok,true);
 assert.equal((await c.send('join',{code,name:'C'})).ok,true);
 const room=h.game.rooms.get(code);
 assert.equal(room.humans.size,3);
 assert.equal((await b.send('start')).ok,false);
 assert.equal((await a.send('start')).ok,true);
 assert.equal(room.phase,'playing');
 assert.equal(room.actors.length,6);
 assert.equal(room.actors.filter(p=>p.bot).length,3);
 assert.equal(room.actors.filter(p=>!p.bot).length,3);
 assert.equal((await b.send('team',1)).ok,false);
});
test('movement, stamina, kick velocity and opponent-only tackling',async()=>{
 const h=harness(),a=h.player('pA');
 const c=await a.send('create',{name:'Pilot'});await a.send('start');
 const room=h.game.rooms.get(c.code);
 room.pause=0;
 const p=room.humans.get('pA');
 const initialZ=p.z;
 a.input({yaw:Math.PI,forward:1,strafe:0,sprint:true,pitch:.12});
 for(let i=0;i<20;i++)h.game.simulate(room,1/30);
 assert.ok(p.z<initialZ-1);
 assert.ok(p.stamina<100);
 room.ball.owner=p.id;room.ball.lock=0;
 assert.equal((await a.send('action',{type:'shoot',power:1})).ok,true);
 assert.equal(room.ball.owner,null);
 assert.ok(Math.hypot(room.ball.vx,room.ball.vz)>22);
 assert.equal((await a.send('action',{type:'shoot',power:1})).ok,false);
 room.ball.owner=room.actors.find(q=>q.bot&&q.team!==p.team)?.id;
 const enemy=room.actors.find(q=>q.id===room.ball.owner);
 p.x=enemy.x+.6;p.z=enemy.z;
 assert.equal((await a.send('action',{type:'tackle'})).ok,true);
 assert.equal(room.ball.owner,p.id);
});
test('goal line, match clock and rematch are authoritative',async()=>{
 const h=harness(),a=h.player('owner');
 const c=await a.send('create',{name:'Captain'});await a.send('start');
 const room=h.game.rooms.get(c.code);room.pause=0;
 Object.assign(room.ball,{x:0,z:-31.7,y:.45,vx:0,vz:-16,vy:0,owner:null,lock:1});
 h.game.simulate(room,1/30);
 assert.deepEqual(room.score,[1,0]);
 assert.ok(room.pause>0);
 room.pause=0;room.time=.01;
 h.game.simulate(room,1/30);
 assert.equal(room.phase,'finished');
 assert.equal(room.reason,'CYAN WINS');
 assert.equal((await a.send('start')).ok,true);
 assert.deepEqual(room.score,[0,0]);
 assert.equal(room.phase,'playing');
});
test('untrusted inputs are clamped and spectators cannot control a match',async()=>{
 const h=harness(),a=h.player('owner'),outsider=h.player('guest');
 const c=await a.send('create',{name:'Captain'});await a.send('start');
 const room=h.game.rooms.get(c.code);
 outsider.input({forward:99,yaw:Infinity});
 assert.equal((await outsider.send('action',{type:'shoot',power:1})).ok,false);
 a.input({forward:100,strafe:-200,yaw:10000000,pitch:100});
 const input=room.humans.get(a.id).input;
 assert.equal(input.forward,1);assert.equal(input.strafe,-1);
 assert.equal(input.pitch,.45);
 assert.ok(input.yaw<=100000);
});
