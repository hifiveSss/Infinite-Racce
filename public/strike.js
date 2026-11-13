import * as THREE from '/vendor/three.module.js';
window.__strikeBoot={stage:'starting',ready:false,error:null};

// Original 3D arena and procedural footballers: no licensed game assets.
const $=id=>document.getElementById(id),show=(id,visible)=>$(id).classList.toggle('hidden',!visible);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hue={cyan:0x82f7db,coral:0xff967c};
let room=null,snapshot=null,myId=null,angleYaw=Math.PI,aimPitch=.045,chargeStart=0,
 lastAction={},goalTimer=null,toastTimer=null,pointerLocked=false,phase='menu',
 playerMeshes=new Map(),renderBall=null,renderBallShadow=null,goalFlash=0;
const keyDown=new Set(),touch={x:0,y:0,sprint:false,turn:null},padPrior={shoot:false,pass:false,tackle:false,lob:false,call:false};
const socket=io('/strike',{transports:['websocket','polling'],reconnection:true,reconnectionDelay:400});
let audio=null;
function beep(freq=380,duration=.11,type='sine',volume=.07){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return;
  audio??=new Ctx();
  if(audio.state==='suspended')void audio.resume();
  const at=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,at);
  o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.7),at+duration);
  g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.001,at+duration);
  o.connect(g);g.connect(audio.destination);o.start(at);o.stop(at+duration+.025);
 }catch{}
}
function toast(message){
 $('toast').textContent=String(message).slice(0,190);$('toast').classList.add('show');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);
}
function ack(event,data,success,failure){
 let settled=false;
 const timeout=setTimeout(()=>{
  if(settled)return;settled=true;
  toast('Server response timed out. Check your connection and retry.');
  failure?.();
 },11000);
 socket.emit(event,data,r=>{
  if(settled)return;settled=true;clearTimeout(timeout);
  if(!r?.ok){toast(r?.error||'Could not complete that action.');failure?.();return}
  success?.(r);
 });
}
function nickname(){
 const name=$('nick').value.trim().slice(0,22)||'Striker';
 try{localStorage.setItem('neonStrikeName',name)}catch{}
 return name;
}
try{$('nick').value=localStorage.getItem('neonStrikeName')||''}catch{}
const params=new URLSearchParams(location.search);
if(params.has('room'))$('roomInput').value=params.get('room').slice(0,6).toUpperCase();
function create(quick=false){
 $('quick').disabled=true;$('create').disabled=true;
 $('quick').textContent='CONNECTING...';
 const reset=()=>{$('quick').disabled=false;$('create').disabled=false;$('quick').textContent='⚡ PLAY NOW — VS BOTS'};
 ack('create',{name:nickname()},r=>{
  reset();myId=socket.id;
  history.replaceState(null,'','/strike.html?room='+r.code);
  if(quick)ack('start',{},()=>toast('Kickoff! Click the pitch for camera controls.'));
 },reset);
}
$('quick').onclick=()=>create(true);
$('create').onclick=()=>create(false);
$('join').onclick=()=>{
 const code=$('roomInput').value.trim().toUpperCase();
 if(code.length!==6){toast('Enter your friend’s six-character code.');return}
 ack('join',{code,name:nickname()},r=>{
  myId=socket.id;history.replaceState(null,'','/strike.html?room='+r.code);
  toast('Joined the match!');
 });
};
$('roomInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('join').click()});
$('start').onclick=()=>ack('start',{},()=>toast('Match starting. Click the field to aim.'));
$('switch').onclick=()=>{
 const self=room?.players.find(p=>p.id===socket.id);
 ack('team',self?.team===0?1:0);
};
$('invite').onclick=()=>{
 if(!room)return;
 const link=location.origin+'/strike.html?room='+room.code;
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(()=>toast('Invite link copied!')).catch(()=>toast('Room code: '+room.code));
 else toast('Room code: '+room.code);
};
function leave(){
 socket.emit('leave',{},()=>{});
 if(document.pointerLockElement)document.exitPointerLock?.();
 room=null;snapshot=null;phase='menu';myId=null;
 history.replaceState(null,'','/strike.html');
 syncUI();
}
$('lobbyLeave').onclick=leave;$('hudLeave').onclick=leave;$('finishLeave').onclick=leave;
$('rematch').onclick=()=>ack('start',{},()=>toast('New match!'));
$('helpButton').onclick=()=>{
 show('helpModal',true);
 if(document.pointerLockElement)document.exitPointerLock?.();
};
$('helpClose').onclick=()=>show('helpModal',false);
socket.on('connect',()=>{$('connectivity').textContent='● CONNECTED';$('connectivity').style.color='#baf7e1'});
socket.on('disconnect',()=>{$('connectivity').textContent='● RECONNECTING';$('connectivity').style.color='#ffba99';toast('Connection interrupted. Reconnect and rejoin if needed.')});
socket.on('lobby',value=>{
 room=value;
 if(!room){phase='menu';snapshot=null;syncUI();return}
 phase=room.phase;
 if(room.phase==='playing'){
  const self=room.players.find(p=>p.id===socket.id);
  if(self&&cameraWasMenu){angleYaw=self.team===0?Math.PI:0;aimPitch=.035;cameraWasMenu=false}
 }else if(room.phase==='finished'){
  if(document.pointerLockElement)document.exitPointerLock?.();
 }
 syncUI();
});
socket.on('snapshot',value=>{
 snapshot=value;
 if(room){room.phase=value.phase;room.score=value.score;room.time=value.time;room.reason=value.reason;phase=value.phase}
 if(value.phase==='playing')cameraWasMenu=false;
 syncUI(false);
});
socket.on('fx',fx=>{
 if(fx.kind==='goal'){
  const team=fx.team===0?'CYAN':'CORAL',scorer=fx.scorer?' · '+fx.scorer.toUpperCase():'';
  $('goalInfo').textContent=team+' SCORES'+scorer;
  $('goalBanner').classList.add('show');
  clearTimeout(goalTimer);goalTimer=setTimeout(()=>$('goalBanner').classList.remove('show'),2250);
  beep(490,.2,'sawtooth',.07);setTimeout(()=>beep(730,.23,'triangle',.1),150);setTimeout(()=>beep(980,.42,'triangle',.1),300);
  spawnConfetti(fx.team);
 }else{
  if(fx.kind==='tackle')beep(150,.13,'sawtooth',.09);
  else if(fx.kind==='kick'||fx.kind==='lob')beep(240,.09,'triangle',.055);
  else if(fx.kind==='pass')beep(360,.09,'sine',.045);
  if(fx.x!==undefined)spawnRing(fx.x,fx.z,fx.team);
 }
});
function syncUI(full=true){
 const inLobby=Boolean(room&&phase==='lobby'),playing=Boolean(room&&phase==='playing'),ended=Boolean(room&&phase==='finished');
 show('menu',!room);show('lobby',inLobby);show('hud',playing);show('finished',ended);
 if(!room){cameraWasMenu=true;return}
 if(inLobby&&full){
  $('roomLabel').textContent=room.code;
  const self=room.players.find(p=>p.id===socket.id);
  for(let team=0;team<2;team++){
   const root=$(team===0?'cyanTeam':'coralTeam');root.replaceChildren();
   for(const p of room.players.filter(p=>p.team===team)){
    const el=document.createElement('div');el.className=p.id===socket.id?'you':'';
    el.textContent=(p.id===socket.id?'▸ ':'')+p.name+(p.id===room.host?' ★':'');root.append(el);
   }
   for(let i=room.players.filter(p=>p.team===team).length;i<3;i++){
    const el=document.createElement('div');el.className='bot';el.textContent='◌ AI PLAYER';root.append(el);
   }
  }
  show('start',room.host===socket.id);
  $('hostNote').textContent=room.host===socket.id?'You’re hosting. Start whenever you’re ready.':'Waiting for the host to kick off…';
  $('switch').textContent='SWITCH TO '+(self?.team===0?'CORAL':'CYAN');
 }
 if(ended){
  $('endTitle').textContent=room.reason||'FULL TIME';
  $('finalScore').textContent=(room.score?.[0]||0)+' — '+(room.score?.[1]||0);
  show('rematch',room.host===socket.id);
  $('rematchNote').textContent=room.host===socket.id?'You can start another match with the same players.':'The host can start another match.';
 }
 if(playing){
  const values=snapshot||room;
  $('score0').textContent=values.score?.[0]??0;$('score1').textContent=values.score?.[1]??0;
  const secs=Math.max(0,Math.ceil(values.time||0));
  $('clock').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
  const self=snapshot?.players.find(p=>p.id===socket.id);
  if(self){
   $('myname').textContent=self.name.toUpperCase();
   $('mypip').style.background=self.team===0?'#97f3dc':'#ff9a7a';
   $('stamina').style.width=self.stamina+'%';
   $('reticle').classList.toggle('hasBall',self.hasBall);
  }
  $('sprintNotice').classList.toggle('hidden',!(values.pause>0));
  $('pointerPrompt').classList.toggle('hidden',pointerLocked);
 }
}

// ---- Input: mouse/keyboard, standard gamepad and touch devices ----
const canvas=$('viewport');
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(phase!=='playing'||$('helpModal').classList.contains('hidden')===false)return;
 if(e.pointerType==='touch'){
  if(e.clientX>innerWidth*.44)touch.turn={id:e.pointerId,x:e.clientX,y:e.clientY};
  return;
 }
 if(!pointerLocked){canvas.requestPointerLock?.();return}
 if(e.button===0&&chargeStart===0)chargeStart=performance.now();
 if(e.button===2)action('pass');
});
window.addEventListener('pointermove',e=>{
 if(e.pointerType==='touch'&&touch.turn?.id===e.pointerId){
  angleYaw+=clamp(e.clientX-touch.turn.x,-60,60)*.004;
  aimPitch=clamp(aimPitch-(e.clientY-touch.turn.y)*.003,-.24,.44);
  touch.turn.x=e.clientX;touch.turn.y=e.clientY;
 }
 if(document.pointerLockElement===canvas){
  angleYaw+=e.movementX*.00245;
  aimPitch=clamp(aimPitch-e.movementY*.0018,-.24,.44);
 }
});
window.addEventListener('pointerup',e=>{
 if(touch.turn?.id===e.pointerId)touch.turn=null;
 if(e.pointerType!=='touch'&&e.button===0&&chargeStart){
  const power=clamp(.3+(performance.now()-chargeStart)/950,.3,1);
  chargeStart=0;action('shoot',{power});
 }
});
document.addEventListener('pointerlockchange',()=>{
 pointerLocked=document.pointerLockElement===canvas;
 if(phase==='playing')$('pointerPrompt').classList.toggle('hidden',pointerLocked);
 if(!pointerLocked)chargeStart=0;
});
window.addEventListener('keydown',e=>{
 if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if([' ','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
 keyDown.add(e.code);
 if(e.repeat||phase!=='playing')return;
 if(e.code==='KeyF'||e.code==='Space')action('tackle');
 if(e.code==='KeyQ')action('lob',{power:.7});
 if(e.code==='KeyE')action('call');
 if(e.code==='KeyK')action('pass');
 if(e.code==='KeyH')$('helpButton').click();
 if(e.code==='KeyR'){const self=snapshot?.players.find(p=>p.id===socket.id);angleYaw=self?.team===0?Math.PI:0;aimPitch=.03}
});
window.addEventListener('keyup',e=>keyDown.delete(e.code));
window.addEventListener('blur',()=>{keyDown.clear();chargeStart=0});
window.addEventListener('contextmenu',e=>{if(e.target===canvas)e.preventDefault()});
function action(type,extra={}){
 if(phase!=='playing')return;
 const now=performance.now(),cooldown=type==='shoot'?180:type==='pass'?180:280;
 if(now-(lastAction[type]||-10000)<cooldown)return;
 lastAction[type]=now;
 socket.emit('action',{type,...extra});
}
const joy=$('joyzone'),knob=$('joystick');
let joyId=null;
function moveJoy(e){
 const box=joy.getBoundingClientRect(),dx=e.clientX-(box.left+box.width/2),dy=e.clientY-(box.top+box.height/2);
 touch.x=clamp(dx/48,-1,1);touch.y=clamp(-dy/48,-1,1);
 const len=Math.max(1,Math.hypot(touch.x,touch.y));touch.x/=len;touch.y/=len;
 knob.style.transform='translate('+(touch.x*43)+'px,'+(-touch.y*43)+'px)';
}
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture?.(joyId);moveJoy(e);e.preventDefault()});
joy.addEventListener('pointermove',e=>{if(joyId===e.pointerId)moveJoy(e)});
function stopJoy(e){if(joyId===e.pointerId){joyId=null;touch.x=0;touch.y=0;knob.style.transform='translate(0,0)'}}
joy.addEventListener('pointerup',stopJoy);joy.addEventListener('pointercancel',stopJoy);
for(const button of document.querySelectorAll('[data-touch-action]')){
 const type=button.dataset.touchAction;
 button.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(type==='sprint')touch.sprint=true;else action(type,{power:.7});
 });
 button.addEventListener('pointerup',()=>{if(type==='sprint')touch.sprint=false});
 button.addEventListener('pointercancel',()=>{if(type==='sprint')touch.sprint=false});
}
const touchShoot=$('touchShoot');
touchShoot.addEventListener('pointerdown',e=>{e.preventDefault();chargeStart=performance.now()});
touchShoot.addEventListener('pointerup',e=>{e.preventDefault();if(chargeStart){action('shoot',{power:clamp(.3+(performance.now()-chargeStart)/950,.3,1)});chargeStart=0}});
touchShoot.addEventListener('pointercancel',()=>chargeStart=0);
function readGamepad(dt){
 const pad=navigator.getGamepads?.()?.find(g=>g?.connected);
 if(!pad)return {x:0,y:0,sprint:false};
 const ax=pad.axes||[];
 const rightX=Math.abs(ax[2]||0)>.16?ax[2]:0,rightY=Math.abs(ax[3]||0)>.16?ax[3]:0;
 angleYaw+=rightX*dt*2.5;aimPitch=clamp(aimPitch-rightY*dt*1.2,-.24,.44);
 const pressed=(name,pressed,fn)=>{
  if(pressed&&!padPrior[name])fn();
  padPrior[name]=pressed;
 };
 const trigger=(pad.buttons?.[7]?.value||0)>.12;
 if(trigger&&!padPrior.shoot)chargeStart=performance.now();
 if(!trigger&&padPrior.shoot&&chargeStart){
  action('shoot',{power:clamp(.3+(performance.now()-chargeStart)/950,.3,1)});chargeStart=0;
 }
 padPrior.shoot=trigger;
 pressed('pass',Boolean(pad.buttons?.[5]?.pressed),()=>action('pass'));
 pressed('tackle',Boolean(pad.buttons?.[2]?.pressed),()=>action('tackle'));
 pressed('lob',Boolean(pad.buttons?.[3]?.pressed),()=>action('lob',{power:.65}));
 pressed('call',Boolean(pad.buttons?.[1]?.pressed),()=>action('call'));
 const leftX=Math.abs(ax[0]||0)>.13?ax[0]:0,leftY=Math.abs(ax[1]||0)>.13?-ax[1]:0;
 return {x:leftX,y:leftY,sprint:Boolean(pad.buttons?.[4]?.pressed||pad.buttons?.[10]?.pressed)};
}
function sendInput(dt){
 if(phase!=='playing')return;
 const gamepad=readGamepad(dt);
 const strafe=clamp((keyDown.has('KeyD')?1:0)-(keyDown.has('KeyA')?1:0)+touch.x+gamepad.x,-1,1);
 const forward=clamp((keyDown.has('KeyW')?1:0)-(keyDown.has('KeyS')?1:0)+touch.y+gamepad.y,-1,1);
 socket.volatile.emit('input',{
  forward,strafe,yaw:angleYaw,pitch:aimPitch,
  sprint:keyDown.has('ShiftLeft')||keyDown.has('ShiftRight')||touch.sprint||gamepad.sprint
 });
}
setInterval(()=>sendInput(.05),50);

// ---- WebGL: hand-built stadium, striped grass, people, goals and lights ----
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=!matchMedia('(pointer:coarse)').matches;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.32;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x07122a);
scene.fog=new THREE.FogExp2(0x08192b,.008);
const camera=new THREE.PerspectiveCamera(69,innerWidth/innerHeight,.12,320);
const ambient=new THREE.HemisphereLight(0xd4e9ff,0x12492c,2.05);scene.add(ambient);
const sunlight=new THREE.DirectionalLight(0xffffff,2.8);sunlight.position.set(-12,38,-6);
sunlight.castShadow=renderer.shadowMap.enabled;
sunlight.shadow.mapSize.set(2048,2048);
sunlight.shadow.camera.left=-49;sunlight.shadow.camera.right=49;sunlight.shadow.camera.top=58;sunlight.shadow.camera.bottom=-58;
sunlight.shadow.bias=-.0002;scene.add(sunlight);
scene.add(new THREE.AmbientLight(0x90aaff,.3));
const fieldMat=new THREE.MeshStandardMaterial({color:0x126449,roughness:.98});
const stripeMats=[0x177658,0x1a7b60].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
function mesh(geometry,material,x=0,y=0,z=0,parent=scene){
 const obj=new THREE.Mesh(geometry,material);obj.position.set(x,y,z);parent.add(obj);return obj;
}
function box(w,h,d,color,x,y,z,parent=scene,emissive=0x000000){
 const mat=new THREE.MeshStandardMaterial({color,metalness:.13,roughness:.75,emissive,emissiveIntensity:.14});
 return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);
}
function cyl(radius,height,color,x,y,z,parent=scene,material=null){
 return mesh(new THREE.CylinderGeometry(radius,radius,height,12),material||new THREE.MeshStandardMaterial({color,roughness:.7}),x,y,z,parent);
}
function line(points,color=0xedfff4,width=1){
 const pts=points.map(p=>new THREE.Vector3(p[0],p[1]??.035,p[2]));
 const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
  new THREE.LineBasicMaterial({color,transparent:true,opacity:.88}));
 scene.add(l);return l;
}
function lineRect(x1,z1,x2,z2,color=0xeafff0){
 line([[x1,.055,z1],[x2,.055,z1],[x2,.055,z2],[x1,.055,z2],[x1,.055,z1]],color);
}
function buildStadium(){
 const ground=mesh(new THREE.PlaneGeometry(180,195),new THREE.MeshStandardMaterial({color:0x0c2838,roughness:1}),0,-.16,0);
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
 const grass=mesh(new THREE.PlaneGeometry(41.2,64),fieldMat,0,-.03,0);grass.rotation.x=-Math.PI/2;grass.receiveShadow=true;
 for(let z=-30;z<32;z+=4){
  const strip=mesh(new THREE.PlaneGeometry(40.9,4),stripeMats[(Math.floor((z+30)/4)%2)],0,-.014,z+2);
  strip.rotation.x=-Math.PI/2;strip.receiveShadow=true;
 }
 const bright=0xdbfff0;
 lineRect(-20.25,-31.75,20.25,31.75,bright);
 line([[-20.25,.065,0],[20.25,.065,0]],bright);
 const circle=[];
 for(let i=0;i<=90;i++){const a=2*Math.PI*i/90;circle.push([Math.cos(a)*7.2,.065,Math.sin(a)*7.2])}
 line(circle,bright);cyl(.2,.08,bright,0,.045,0);
 for(const side of [-1,1]){
  const z=side*31.75,inside=side*20.2;
  lineRect(-11.5,Math.min(z,inside),11.5,Math.max(z,inside));
  lineRect(-5.6,Math.min(z,side*27.1),5.6,Math.max(z,side*27.1));
  cyl(.13,.06,bright,0,.05,side*24.3);
 }
 const neonBlue=new THREE.MeshBasicMaterial({color:0x47fbea});
 const neonRose=new THREE.MeshBasicMaterial({color:0xff7e8e});
 const whiteSteel=new THREE.MeshStandardMaterial({color:0xe4ffff,metalness:.65,roughness:.21});
 function beam(a,b,r,mat=whiteSteel){
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),diff=end.clone().sub(start);
  const obj=mesh(new THREE.CylinderGeometry(r,r,diff.length(),8),mat);
  obj.position.copy(start).addScaledVector(diff,.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize());
  return obj;
 }
 const netMat=new THREE.LineBasicMaterial({color:0xb5ffff,transparent:true,opacity:.35});
 for(const side of [-1,1]){
  const z=side*31.78,back=side*34.5;
  for(const x of [-6.3,6.3]){
   beam([x,.05,z],[x,3.45,z],.13);beam([x,3.45,z],[x,3.45,back],.07);
   beam([x,.05,z],[x,.06,back],.06);
  }
  beam([-6.3,3.45,z],[6.3,3.45,z],.13);
  beam([-6.3,3.45,back],[6.3,3.45,back],.07);
  for(let x=-6.3;x<=6.4;x+=.63){
   const verts=[[x,.06,back],[x,3.45,back],[x,3.45,z]];
   for(let j=0;j<2;j++)scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...verts[j]),new THREE.Vector3(...verts[j+1])]),netMat));
  }
  for(let y=.15;y<=3.55;y+=.5){
   scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-6.3,y,back),new THREE.Vector3(6.3,y,back)]),netMat));
  }
  const goalLight=box(12.65,.12,.18,side<0?0x66ffe0:0xffa097,0,3.53,z,scene);
  goalLight.material.emissive.set(side<0?0x50ffff:0xff745e);goalLight.material.emissiveIntensity=2.3;
  const floorGlow=mesh(new THREE.PlaneGeometry(13,3),new THREE.MeshBasicMaterial({color:side<0?0x4afbec:0xffa481,transparent:true,opacity:.12,side:THREE.DoubleSide}),0,.003,side*33);
  floorGlow.rotation.x=-Math.PI/2;
 }
 // Transparent walls keep the action continuous, as in a fenced street court.
 const wallMaterial=new THREE.MeshPhysicalMaterial({color:0x7cd9ea,transparent:true,opacity:.07,roughness:.1,metalness:.2,side:THREE.DoubleSide,depthWrite:false});
 for(const x of [-20.65,20.65]){
  box(.13,5,65,0x25acb1,x,2.6,0);
  const wall=mesh(new THREE.PlaneGeometry(65,4.8),wallMaterial,x,2.5,0);wall.rotation.y=Math.PI/2;
  for(const z of [-31,-20,-9,2,13,24,31])beam([x,0,z],[x,5.5,z],.05,neonBlue);
  beam([x,5.5,-31],[x,5.5,31],.05,neonBlue);
 }
 for(const z of [-32.2,32.2]){
  const wall=mesh(new THREE.PlaneGeometry(41,4.7),wallMaterial,0,2.55,z);
  for(let x=-20;x<=20;x+=10)beam([x,0,z],[x,5.5,z],.045,neonRose);
  beam([-20.4,5.5,z],[20.4,5.5,z],.06,neonRose);
 }
 // Tiered spectator seats, animated-light look without downloading crowd assets.
 for(const side of [-1,1]){
  for(let tier=0;tier<6;tier++){
   const offset=24+tier*2,level=.4+tier*.85;
   box(2.2,.65,78,0x122438,side*offset,level,0);
   if(tier%2===1)box(.35,.09,78,0x39d7d0,side*(offset-1),level+.42,0);
  }
 }
 for(let tier=0;tier<7;tier++){
  for(const side of [-1,1]){
   const z=35+tier*2.1;
   box(42,.72,2.4,0x132035,0,.4+tier*.75,side*z);
  }
 }
 // Instanced spectator colors: thousands of points in 1 draw call.
 const fanCount=2500,colors=[0x6ce8d9,0xffae94,0xc6a0f7,0xffedb7,0x518ed5];
 const fanGeo=new THREE.SphereGeometry(.115,5,4),fanMat=new THREE.MeshBasicMaterial({color:0xffffff});
 const fans=new THREE.InstancedMesh(fanGeo,fanMat,fanCount),temp=new THREE.Object3D(),color=new THREE.Color();
 for(let i=0;i<fanCount;i++){
  const side=(i%2===0)?1:-1,which=i%5,tier=Math.floor(Math.random()*6);
  const x=side*(23+tier*2)+Math.random()*1.8*side,z=(Math.random()-.5)*73;
  const y=.5+tier*.85+Math.random()*.45;
  if(i%5===1){temp.position.set((Math.random()-.5)*42,.8+tier*.8,side*(35+tier*2))}
  else temp.position.set(x,y,z);
  temp.scale.setScalar(.55+Math.random()*.75);temp.updateMatrix();fans.setMatrixAt(i,temp.matrix);
  color.setHex(fansColor(i));fans.setColorAt(i,color);
 }
 function fansColor(i){return colors[(i+Math.floor(Math.random()*5))%colors.length]}
 fans.instanceMatrix.needsUpdate=true;scene.add(fans);
 // Light towers, illuminated signs and an open-roof stadium skyline.
 for(const x of [-33,33])for(const z of [-42,42]){
  box(1.5,26,1.5,0x293c59,x,13,z);
  const housing=box(9,2.3,.8,0xb5eaff,x,25,z);
  housing.material.emissive.set(0xa0c9ff);housing.material.emissiveIntensity=1.5;
  const light=new THREE.PointLight(0xc5f2ff,18,65,2);light.position.set(x,24,z);scene.add(light);
 }
 for(let i=0;i<19;i++){
  const x=(Math.random()-.5)*175,z=-90-Math.random()*45,h=20+Math.random()*65;
  const tower=box(4+Math.random()*9,h,3+Math.random()*9,0x101b33,x,h*.5-3,z);
  tower.material.emissive.set(0x13213c);tower.material.emissiveIntensity=.4;
  for(let floor=6;floor<h;floor+=4){
   const led=box(2,.14,.05,i%3===0?0x17d6c7:0x6e83ce,x,floor,z+3);
   led.material.emissive.set(i%3===0?0x14b3b4:0x495bca);led.material.emissiveIntensity=.5;
  }
 }
 // Bold perimeter advertising.
 for(const side of [-1,1]){
  for(let i=0;i<10;i++){
   const color=i%3===0?0x58ffdb:i%3===1?0xff947e:0xaab7ff;
   const strip=box(.12,.75,5.1,color,side*20.65,.48,-27+i*6);
   strip.material.emissive.set(color);strip.material.emissiveIntensity=.9;
  }
 }
}
buildStadium();
const sphere=new THREE.SphereGeometry(.42,28,16);
const ballGroup=new THREE.Group();scene.add(ballGroup);
const ballBody=mesh(sphere,new THREE.MeshStandardMaterial({color:0xfbfcff,roughness:.38,metalness:.04}),0,0,0,ballGroup);
const dots=new THREE.MeshBasicMaterial({color:0x15233b});
for(const a of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[.6,.6,.6],[-.6,-.6,.6]]){
 const dir=new THREE.Vector3(...a).normalize(),patch=mesh(new THREE.CircleGeometry(.115,5),dots,dir.x*.421,dir.y*.421,dir.z*.421,ballGroup);
 patch.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
}
renderBall=ballGroup;
renderBallShadow=mesh(new THREE.CircleGeometry(.55,24),new THREE.MeshBasicMaterial({color:0x061c15,transparent:true,opacity:.38,depthWrite:false}),0,.012,0);
renderBallShadow.rotation.x=-Math.PI/2;
const groundRingGeo=new THREE.RingGeometry(.62,.76,32);
function makeNameTag(name,team){
 const c=document.createElement('canvas');c.width=384;c.height=90;
 const g=c.getContext('2d');
 g.fillStyle='#051627dc';g.beginPath();g.roundRect(8,8,368,70,18);g.fill();
 g.strokeStyle=team===0?'#8ffff0':'#ffad8a';g.lineWidth=3;g.stroke();
 g.fillStyle='#ffffff';g.textAlign='center';g.textBaseline='middle';g.font='900 33px Arial';
 g.fillText(name.toUpperCase().slice(0,14),192,43,338);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});
 const sprite=new THREE.Sprite(material);sprite.position.y=2.85;sprite.scale.set(2.6,.61,1);
 return sprite;
}
function bodyPart(geometry,material,x,y,z,parent){
 const o=mesh(geometry,material,x,y,z,parent);o.castShadow=true;return o;
}
function buildPlayer(p){
 const root=new THREE.Group();scene.add(root);
 const kitColor=p.team===0?0x68f1d6:0xff816c,shortsColor=p.team===0?0x063a56:0x54314a;
 const jersey=new THREE.MeshStandardMaterial({color:kitColor,roughness:.83,metalness:.06});
 const shorts=new THREE.MeshStandardMaterial({color:shortsColor,roughness:.89});
 const skin=new THREE.MeshStandardMaterial({color:((p.slot+p.team)%3===0?0xb77a57:(p.slot+p.team)%3===1?0xe2ae84:0x986446),roughness:.8});
 const shoe=new THREE.MeshStandardMaterial({color:0xf1f7f9,roughness:.53});
 const hair=new THREE.MeshStandardMaterial({color:0x141827,roughness:1});
 const torso=new THREE.Group();root.add(torso);
 bodyPart(new THREE.CapsuleGeometry(.37,.76,5,10),jersey,0,1.42,0,torso);
 bodyPart(new THREE.BoxGeometry(.78,.13,.23),new THREE.MeshStandardMaterial({color:0xf7ffff}),0,1.91,0,torso);
 bodyPart(new THREE.CylinderGeometry(.36,.38,.38,10),shorts,0,.91,0,torso);
 bodyPart(new THREE.SphereGeometry(.26,12,10),skin,0,2.14,0,torso);
 bodyPart(new THREE.SphereGeometry(.27,12,10,0,Math.PI*2,0,Math.PI*.43),hair,0,2.31,0,torso);
 const limbs=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.49,1.83,0);torso.add(arm);
  bodyPart(new THREE.CapsuleGeometry(.125,.48,4,9),jersey,0,-.35,0,arm);
  bodyPart(new THREE.SphereGeometry(.115,8,8),skin,0,-.7,0,arm);
  const leg=new THREE.Group();leg.position.set(side*.21,.79,0);root.add(leg);
  bodyPart(new THREE.CapsuleGeometry(.16,.58,4,8),skin,0,-.39,0,leg);
  bodyPart(new THREE.CapsuleGeometry(.175,.26,4,8),shorts,0,-.04,0,leg);
  bodyPart(new THREE.BoxGeometry(.28,.17,.48),shoe,0,-.84,.14,leg);
  limbs.push({arm,leg,side});
 }
 const shadow=mesh(new THREE.CircleGeometry(.55,20),new THREE.MeshBasicMaterial({color:0x02110b,transparent:true,opacity:.27,depthWrite:false}),0,.015,0,root);
 shadow.rotation.x=-Math.PI/2;
 const ring=mesh(groundRingGeo,new THREE.MeshBasicMaterial({color:p.team===0?0x90ffda:0xff956d,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}),0,.028,0,root);
 ring.rotation.x=-Math.PI/2;
 const label=makeNameTag(p.name,p.team);root.add(label);
 const me=p.id===socket.id;
 if(me)ring.scale.setScalar(1.45);
 return {root,torso,limbs,label,ring,lastX:p.x,lastZ:p.z,team:p.team,me,target:p,elapsed:0};
}
function syncActors(dt,seconds){
 if(!snapshot)return;
 const active=new Set();
 for(const p of snapshot.players){
  active.add(p.id);
  let model=playerMeshes.get(p.id);
  if(!model||model.team!==p.team){
   if(model){scene.remove(model.root);disposePlayer(model);playerMeshes.delete(p.id)}
   model=buildPlayer(p);model.root.position.set(p.x,0,p.z);model.root.rotation.y=p.yaw;playerMeshes.set(p.id,model);
  }
  model.target=p;
  const blend=1-Math.exp(-dt*(p.id===socket.id?17:12));
  model.root.position.x=THREE.MathUtils.lerp(model.root.position.x,p.x,blend);
  model.root.position.z=THREE.MathUtils.lerp(model.root.position.z,p.z,blend);
  let turn=p.yaw-model.root.rotation.y;turn=Math.atan2(Math.sin(turn),Math.cos(turn));
  model.root.rotation.y+=turn*Math.min(1,dt*11);
  const speed=Math.hypot(p.vx,p.vz),run=Math.min(1,speed/9);
  model.elapsed+=dt*(speed*1.22+1.8);
  model.root.position.y=(p.tackling?-.3:0)+Math.max(0,.032*Math.sin(model.elapsed*2)*run);
  model.torso.rotation.x=p.tackling?-.75:run*.09;
  for(const limb of model.limbs){
   limb.leg.rotation.x=Math.sin(model.elapsed)*run*(limb.side===1?1:-1)*.58;
   limb.arm.rotation.x=Math.sin(model.elapsed)*run*(limb.side===1?-1:1)*.64;
  }
  model.ring.material.opacity=p.hasBall?.93:model.me?.72:.2;
  model.ring.visible=model.me||p.hasBall;
  model.label.visible=p.bot===false||p.hasBall;
  if(model.me){
   model.label.position.y=3.05;
   model.ring.rotation.z=seconds*.35;
  }
 }
 for(const [id,model] of playerMeshes){
  if(active.has(id))continue;scene.remove(model.root);disposePlayer(model);playerMeshes.delete(id);
 }
}
function disposePlayer(model){
 model.root.traverse(node=>{if(node.isMesh||node.isSprite){node.geometry?.dispose?.();node.material?.map?.dispose?.();node.material?.dispose?.()}});
}
const fxParticles=[];
function spawnRing(x,z,team){
 const geo=new THREE.RingGeometry(.3,.42,26),mat=new THREE.MeshBasicMaterial({color:team===0?0x6bffe6:0xff987a,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
 const part=mesh(geo,mat,x,.14,z);part.rotation.x=-Math.PI/2;
 fxParticles.push({obj:part,life:.35,total:.35,type:'ring'});
}
function spawnConfetti(team){
 for(let i=0;i<110;i++){
  const mat=new THREE.MeshBasicMaterial({color:i%3===0?0xffffff:i%3===1?team===0?0x7bffda:0xffa38c:0xffef8d,side:THREE.DoubleSide});
  const obj=mesh(new THREE.PlaneGeometry(.1+Math.random()*.13,.18+Math.random()*.14),mat,(Math.random()-.5)*20,3+Math.random()*8,(Math.random()-.5)*16);
  fxParticles.push({obj,life:1.3+Math.random()*1.4,total:2.2,type:'confetti',vx:(Math.random()-.5)*6,vz:(Math.random()-.5)*8,vy:-1-Math.random()*3,rot:Math.random()*6});
 }
}
function updateFx(dt){
 for(let i=fxParticles.length-1;i>=0;i--){
  const f=fxParticles[i];f.life-=dt;
  if(f.type==='ring'){f.obj.scale.addScalar(dt*5);f.obj.material.opacity=Math.max(0,f.life/f.total)}
  else{f.obj.position.x+=f.vx*dt;f.obj.position.z+=f.vz*dt;f.obj.position.y+=f.vy*dt;f.obj.rotation.set(f.rot+f.life*5,f.rot+f.life*2,0)}
  if(f.life<=0){scene.remove(f.obj);f.obj.geometry.dispose();f.obj.material.dispose();fxParticles.splice(i,1)}
 }
}
const mapCtx=$('minimap').getContext('2d');
function drawMap(){
 if(!snapshot)return;
 const c=mapCtx,w=160,h=210;
 c.clearRect(0,0,w,h);c.fillStyle='#061e23b0';c.fillRect(0,0,w,h);
 c.strokeStyle='#a9e5d0a1';c.lineWidth=1.5;
 c.strokeRect(14,8,w-28,h-16);
 c.beginPath();c.moveTo(14,h/2);c.lineTo(w-14,h/2);c.stroke();
 c.beginPath();c.ellipse(w/2,h/2,18,18,0,0,Math.PI*2);c.stroke();
 const px=x=>w/2+x/41*(w-28),pz=z=>h/2+z/64*(h-16);
 for(const p of snapshot.players){
  c.fillStyle=p.id===socket.id?'#ffffff':p.team===0?'#65eecf':'#ff9779';
  c.beginPath();c.arc(px(p.x),pz(p.z),p.id===socket.id?5:3.4,0,Math.PI*2);c.fill();
  if(p.id===socket.id){c.strokeStyle='#ffffff';c.beginPath();c.arc(px(p.x),pz(p.z),7,0,Math.PI*2);c.stroke()}
 }
 c.fillStyle='#fff09a';c.beginPath();c.arc(px(snapshot.ball.x),pz(snapshot.ball.z),4.3,0,Math.PI*2);c.fill();
}
let seconds=0,cameraWasMenu=true,last=performance.now(),prevMap=0;
const springTarget=new THREE.Vector3(),camWanted=new THREE.Vector3(),lookWanted=new THREE.Vector3(),camLook=new THREE.Vector3(0,1,0);
camera.position.set(0,19,55);
function cameraTick(dt){
 const p=snapshot?.players.find(p=>p.id===socket.id);
 if(phase==='playing'&&p){
  const current=playerMeshes.get(p.id)?.root.position||p;
  const fx=Math.sin(angleYaw),fz=Math.cos(angleYaw);
  camWanted.set(current.x-fx*7.6,4.4+aimPitch*2,current.z-fz*7.6);
  camWanted.x=clamp(camWanted.x,-31,31);camWanted.z=clamp(camWanted.z,-41,41);
  lookWanted.set(current.x+fx*9,1.65+aimPitch*11,current.z+fz*9);
  camera.fov=keyDown.has('ShiftLeft')?74:68;
  camera.updateProjectionMatrix();
 }else{
  camera.fov=66;camera.updateProjectionMatrix();
  camWanted.set(35*Math.sin(seconds*.05),18+2*Math.sin(seconds*.12),45*Math.cos(seconds*.05));
  lookWanted.set(0,1,0);
 }
 const fraction=1-Math.exp(-dt*(phase==='playing'?8:1.2));
 camera.position.lerp(camWanted,fraction);
 camLook.lerp(lookWanted,1-Math.exp(-dt*8));camera.lookAt(camLook);
}
function updateBall(dt){
 if(!snapshot?.ball)return;
 const b=snapshot.ball,blend=1-Math.exp(-dt*15);
 renderBall.position.lerp(new THREE.Vector3(b.x,b.y,b.z),blend);
 renderBall.rotation.x+=dt*(b.vz*1.4+1);renderBall.rotation.z-=dt*b.vx*.9;
 renderBallShadow.position.x=renderBall.position.x;renderBallShadow.position.z=renderBall.position.z;
 renderBallShadow.material.opacity=.35*Math.max(.2,1-renderBall.position.y/7);
}
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,(now-last)/1000||.016);last=now;seconds+=dt;
 syncActors(dt,seconds);updateBall(dt);updateFx(dt);cameraTick(dt);
 if(now-prevMap>130&&phase==='playing'){drawMap();prevMap=now}
 if(chargeStart){
  $('charge').style.width=Math.floor(clamp(.3+(performance.now()-chargeStart)/950,.3,1)*100)+'%';
 }else $('charge').style.width='0%';
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
window.__strikeBoot.stage='running';window.__strikeBoot.ready=true;
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);
syncUI();
