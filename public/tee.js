const $=id=>document.getElementById(id),socket=io('/tee');
const canvas=$('paint'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const W=canvas.width,H=canvas.height;
const palette=['#161325','#ffffff','#e93b4b','#f59498','#ff802e','#ffcf45','#fff19a','#8cc83c','#19b784','#70e4c6','#1e90ff','#83cafa','#543cb7','#a987e8','#de54bd','#f0a2d5','#8c5341','#dba56f','#767676','#000000'];
const shirtPalette=['#ffffff','#191c29','#ffe2e4','#d2efff','#fff0ac','#d8f9da','#e9ddff','#f0d8bc','#fdd5bd'];
const tools=new Set(['brush','eraser','line','rect','ellipse','fill','eyedropper','text']);
const $show=id=>$(id).classList.remove('hidden'),$hide=id=>$(id).classList.add('hidden');
let game=null,privateTask=null,previousStage='',lastToast=null,activePointer=null,paintColor='#161325',shirtColor='#ffffff',selectedTool='brush',brushSize=13,opacity=1;
let undoStack=[],future=[],latestPreview=null;
const textNode=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n};
function toast(message){
 const el=$('toast');el.textContent=message;el.classList.add('on');clearTimeout(lastToast);lastToast=setTimeout(()=>el.classList.remove('on'),3300);
}
const call=(event,data,success)=>socket.emit(event,data,answer=>{if(!answer?.ok)toast(answer?.error||'Something went wrong');else success?.(answer)});
const host=()=>game?.host===socket.id;
const task=()=>privateTask?.stage===game?.stage?privateTask:null;
const me=()=>game?.players?.find(p=>p.id===socket.id);
try{$('playerName').value=sessionStorage.getItem('teeName')||''}catch{}
const requestedRoom=new URLSearchParams(location.search).get('room');if(requestedRoom)$('joinCode').value=requestedRoom.slice(0,6).toUpperCase();
function saveName(){try{sessionStorage.setItem('teeName',$('playerName').value.trim())}catch{}}
$('createRoom').onclick=()=>{saveName();call('create',{name:$('playerName').value},r=>{window.history.replaceState(null,'','/tee.html?room='+r.code);toast('Room created! Invite your friends.')})};
$('joinRoom').onclick=()=>{saveName();call('join',{name:$('playerName').value,code:$('joinCode').value},r=>{window.history.replaceState(null,'','/tee.html?room='+r.code);toast('You joined!')})};
$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinRoom').click()});
$('leave').onclick=()=>call('leave',{},()=>{game=null;privateTask=null;previousStage='';window.history.replaceState(null,'','/tee.html');render()});
$('invite').onclick=()=>{
 const link=location.origin+'/tee.html?room='+game.code;
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(()=>toast('Invite link copied!')).catch(()=>toast('Room code: '+game.code));
 else toast('Room code: '+game.code);
};
$('startGame').onclick=()=>call('start',{});
$('playAgain').onclick=()=>call('start',{});
$('skipStage').onclick=()=>call('skip',{});
$('submitSlogans').onclick=()=>call('slogans',{first:$('sloganOne').value,second:$('sloganTwo').value},()=>{privateTask={...task(),stage:'slogans',already:true};renderSlogans()});
socket.on('disconnect',()=>toast('Connection lost. Rejoin your room if needed.'));
socket.on('state',r=>{game=r;if(!r){privateTask=null;previousStage=''}render()});
socket.on('task',t=>{privateTask=t;render()});
socket.on('progress',p=>{if(game?.stage!==p.stage)return;game.done=p.done;renderProgress()});
const teeSVG='<svg viewBox="0 0 300 320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M80 22 L117 7 Q150 28 183 7 L220 22 L292 72 L254 132 L224 109 L224 303 Q150 314 76 303 L76 109 L46 132 L8 72 Z" fill="#fff" stroke="#7b7393" stroke-width="4" stroke-linejoin="round"/><path d="M118 8 Q150 58 182 8 Q150 26 118 8Z" fill="#c6bcca" opacity=".55"/><path d="M77 107 L77 301 M223 107 L223 301" fill="none" stroke="#6b5f7a" stroke-opacity=".21" stroke-width="3"/></svg>';
function shirtView(item,large=false){
 const model=item||{color:'#ffffff',art:null,slogan:''};
 const root=textNode('div','shirtArt'+(large?' large':'')),svg=document.createElement('div');
 svg.innerHTML=teeSVG;
 svg.style.height='100%';svg.querySelector('path')?.setAttribute('fill',model.color||'#ffffff');
 root.append(svg);
 if(model.art){
  const img=document.createElement('img');img.className='shirtImage';img.alt='Player-designed shirt art';img.src=model.art;
  root.append(img);
 }else if(item&&item.id){
  const placeholder=textNode('div','shirtImage','🎨');
  placeholder.style.fontSize='clamp(28px,4vw,56px)';placeholder.style.textAlign='center';placeholder.style.display='grid';placeholder.style.placeItems='center';
  root.append(placeholder);
 }
 if(model.slogan){
  const slogan=textNode('div','shirtSlogan',model.slogan);
  const dark=['#191c29'].includes(model.color);slogan.style.color=dark?'#fefeff':'#27212a';
  root.append(slogan);
 }
 return root;
}
function updatePreview(){
 try{latestPreview=canvas.toDataURL('image/png')}catch{latestPreview=null}
 $('liveShirt').replaceChildren(shirtView({color:shirtColor,art:latestPreview,slogan:''}));
}
function saveHistory(){
 undoStack.push(ctx.getImageData(0,0,W,H));
 if(undoStack.length>22)undoStack.shift();
 future=[];updateUndoButtons();
}
function updateUndoButtons(){
 $('undo').disabled=undoStack.length===0;
 $('redo').disabled=future.length===0;
}
function undo(){
 if(!undoStack.length||activePointer)return;
 future.push(ctx.getImageData(0,0,W,H));ctx.putImageData(undoStack.pop(),0,0);updateUndoButtons();updatePreview();
}
function redo(){
 if(!future.length||activePointer)return;
 undoStack.push(ctx.getImageData(0,0,W,H));ctx.putImageData(future.pop(),0,0);updateUndoButtons();updatePreview();
}
function clearDrawing(){
 saveHistory();ctx.clearRect(0,0,W,H);updatePreview();
}
$('undo').onclick=undo;$('redo').onclick=redo;
$('clearArt').onclick=()=>{if(confirm('Clear this drawing? You can undo afterward.'))clearDrawing()};
$('saveArt').onclick=()=>{
 const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='tee-riot-art.png';link.click();
};
function editable(){
 return game?.stage==='drawing'&&!task()?.already;
}
function setTool(name){
 if(!tools.has(name))return;
 selectedTool=name;
 document.querySelectorAll('[data-tool]').forEach(button=>{
  const active=button.dataset.tool===name;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 $('stampControls').classList.toggle('hidden',name!=='text');
 canvas.style.cursor=name==='eraser'?'cell':name==='eyedropper'?'copy':'crosshair';
}
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
function colorChanged(value){
 paintColor=value.toLowerCase();$('customColor').value=paintColor;
 document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('selected',b.dataset.color===paintColor));
}
for(const color of palette){
 const button=document.createElement('button');
 button.type='button';button.className='swatch';button.dataset.color=color;button.title=color;button.setAttribute('aria-label','Select colour '+color);
 button.style.backgroundColor=color;
 button.onclick=()=>colorChanged(color);
 $('paintColors').append(button);
}
$('customColor').oninput=e=>colorChanged(e.target.value);
for(const color of shirtPalette){
 const button=document.createElement('button');button.type='button';button.className='shirtSwatch';
 button.style.backgroundColor=color;button.dataset.shirt=color;button.title='Shirt colour '+color;button.setAttribute('aria-label','Shirt colour '+color);
 button.onclick=()=>{shirtColor=color;document.querySelectorAll('.shirtSwatch').forEach(b=>b.classList.toggle('selected',b.dataset.shirt===color));updatePreview()};
 $('shirtColors').append(button);
}
$('brushSize').oninput=e=>{brushSize=Number(e.target.value);$('sizeLabel').textContent=brushSize+'px'};
$('opacity').oninput=e=>{opacity=Number(e.target.value)/100;$('opacityLabel').textContent=e.target.value+'%'};
$('stampText').oninput=()=>{};
function point(e){
 const rect=canvas.getBoundingClientRect();
 return {x:Math.max(0,Math.min(W,(e.clientX-rect.left)*W/rect.width)),y:Math.max(0,Math.min(H,(e.clientY-rect.top)*H/rect.height))};
}
function ink(){
 ctx.globalCompositeOperation=selectedTool==='eraser'?'destination-out':'source-over';
 ctx.globalAlpha=selectedTool==='eraser'?1:opacity;ctx.strokeStyle=paintColor;ctx.fillStyle=paintColor;
 ctx.lineWidth=brushSize;ctx.lineCap='round';ctx.lineJoin='round';
}
function drawShape(from,to){
 ink();ctx.beginPath();
 if(selectedTool==='line'){ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke()}
 else if(selectedTool==='rect'){
  const x=Math.min(from.x,to.x),y=Math.min(from.y,to.y);
  const w=Math.abs(to.x-from.x),h=Math.abs(to.y-from.y);
  if($('fillShape').checked)ctx.fillRect(x,y,w,h);else ctx.strokeRect(x,y,w,h);
 }else if(selectedTool==='ellipse'){
  const x=(from.x+to.x)/2,y=(from.y+to.y)/2;
  const rx=Math.max(.01,Math.abs(from.x-to.x)/2),ry=Math.max(.01,Math.abs(from.y-to.y)/2);
  ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  if($('fillShape').checked)ctx.fill();else ctx.stroke();
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
}
function pickColor(at){
 const p=ctx.getImageData(Math.floor(at.x),Math.floor(at.y),1,1).data;
 if(p[3]===0){toast('Click a painted pixel to sample its colour');return}
 const hex='#'+[p[0],p[1],p[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
 colorChanged(hex);setTool('brush');toast('Colour sampled!');
}
function stampText(at){
 const value=$('stampText').value.trim();
 if(!value){toast('Enter some text first');$('stampText').focus();return}
 saveHistory();ink();ctx.font='900 '+Math.max(15,Math.round(brushSize*3.2))+'px Arial, sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,at.x,at.y,W*.95);ctx.globalAlpha=1;
 updatePreview();
}
function hexToRGBA(hex,alpha){
 const h=hex.replace('#','');
 return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),Math.round(alpha*255)];
}
function floodFill(at){
 const image=ctx.getImageData(0,0,W,H),a=image.data;
 const sx=Math.max(0,Math.min(W-1,Math.floor(at.x))),sy=Math.max(0,Math.min(H-1,Math.floor(at.y)));
 const idx=(sy*W+sx)*4,target=[a[idx],a[idx+1],a[idx+2],a[idx+3]],next=hexToRGBA(paintColor,opacity);
 if(target.every((v,i)=>Math.abs(v-next[i])<4))return;
 saveHistory();
 const visited=new Uint8Array(W*H),queue=new Int32Array(W*H);
 let head=0,tail=0;queue[tail++]=sy*W+sx;visited[sy*W+sx]=1;
 const tolerance=44;
 function matches(pixel){
  const j=pixel*4;
  return Math.abs(a[j]-target[0])+Math.abs(a[j+1]-target[1])+Math.abs(a[j+2]-target[2])+Math.abs(a[j+3]-target[3])<=tolerance;
 }
 while(head<tail){
  const cell=queue[head++],j=cell*4;
  if(!matches(cell))continue;
  a[j]=next[0];a[j+1]=next[1];a[j+2]=next[2];a[j+3]=next[3];
  const x=cell%W,y=(cell/W)|0;
  const neighbours=[x>0?cell-1:-1,x<W-1?cell+1:-1,y>0?cell-W:-1,y<H-1?cell+W:-1];
  for(const nb of neighbours){if(nb<0||visited[nb])continue;visited[nb]=1;if(matches(nb))queue[tail++]=nb}
 }
 ctx.putImageData(image,0,0);updateUndoButtons();updatePreview();
}
function beginPointer(e){
 if(!editable()||activePointer||e.button>0&&e.pointerType==='mouse')return;
 e.preventDefault();const p=point(e);
 if(selectedTool==='eyedropper')return pickColor(p);
 if(selectedTool==='fill')return floodFill(p);
 if(selectedTool==='text')return stampText(p);
 saveHistory();
 activePointer={id:e.pointerId,start:p,last:p,mid:p,snapshot:ctx.getImageData(0,0,W,H)};
 try{canvas.setPointerCapture(e.pointerId)}catch{}
 if(selectedTool==='brush'||selectedTool==='eraser'){
  ink();ctx.beginPath();ctx.arc(p.x,p.y,brushSize/2,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(p.x,p.y);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 }
}
function movePointer(e){
 const stroke=activePointer;
 if(!stroke||stroke.id!==e.pointerId)return;
 e.preventDefault();const p=point(e);
 if(selectedTool==='brush'||selectedTool==='eraser'){
  const mid={x:(stroke.last.x+p.x)/2,y:(stroke.last.y+p.y)/2};
  ink();ctx.beginPath();ctx.moveTo(stroke.mid.x,stroke.mid.y);ctx.quadraticCurveTo(stroke.last.x,stroke.last.y,mid.x,mid.y);
  ctx.stroke();stroke.last=p;stroke.mid=mid;
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 }else{
  ctx.putImageData(stroke.snapshot,0,0);drawShape(stroke.start,p);stroke.last=p;
 }
}
function endPointer(e){
 const stroke=activePointer;if(!stroke||stroke.id!==e.pointerId)return;
 e.preventDefault();const p=point(e);
 if(selectedTool==='brush'||selectedTool==='eraser'){
  ink();ctx.beginPath();ctx.moveTo(stroke.mid.x,stroke.mid.y);ctx.quadraticCurveTo(stroke.last.x,stroke.last.y,p.x,p.y);ctx.stroke();
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 }else{ctx.putImageData(stroke.snapshot,0,0);drawShape(stroke.start,p)}
 activePointer=null;updatePreview();
}
canvas.addEventListener('pointerdown',beginPointer);
canvas.addEventListener('pointermove',movePointer);
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
window.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey){
  if(e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo()}
  else if(e.key.toLowerCase()==='y'){e.preventDefault();redo()}
  return;
 }
 if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(e.key.toLowerCase()==='b')setTool('brush');
 if(e.key.toLowerCase()==='e')setTool('eraser');
});
function resetArt(){
 ctx.clearRect(0,0,W,H);undoStack=[];future=[];$('stampText').value='';
 shirtColor='#ffffff';colorChanged('#161325');setTool('brush');$('brushSize').value=13;brushSize=13;$('sizeLabel').textContent='13px';
 $('opacity').value=100;opacity=1;$('opacityLabel').textContent='100%';$('fillShape').checked=false;
 document.querySelectorAll('.shirtSwatch').forEach(b=>b.classList.toggle('selected',b.dataset.shirt===shirtColor));
 updateUndoButtons();updatePreview();
}
function exportArt(){
 let image=canvas.toDataURL('image/webp',.81);
 if(!image.startsWith('data:image/webp;'))image=canvas.toDataURL('image/png');
 if(image.length>450000){
  const smaller=document.createElement('canvas');smaller.width=480;smaller.height=480;
  smaller.getContext('2d').drawImage(canvas,0,0,480,480);
  image=smaller.toDataURL('image/webp',.72);
  if(!image.startsWith('data:image/webp;'))image=smaller.toDataURL('image/png');
 }
 if(image.length>450000)throw Error('Artwork is still too large. Use less detail or clear a part of your canvas.');
 return image;
}
$('submitArt').onclick=()=>{
 if(!editable()||$('submitArt').disabled)return;
 try{
  const image=exportArt(),button=$('submitArt');
  button.disabled=true;button.textContent='Uploading your artwork…';
  socket.emit('drawing',{image,color:shirtColor},answer=>{
   button.disabled=false;button.textContent='Lock in my artwork →';
   if(!answer?.ok){toast(answer?.error||'Could not save drawing');return}
   if(game?.stage==='drawing'){privateTask={...task(),stage:'drawing',already:true};renderDrawing()}
  });
 }catch(error){$('submitArt').disabled=false;toast(error.message)}
};
function renderLobby(){
 $('lobbyCode').textContent=game.code;
 $('lobbyPlayers').replaceChildren();
 for(const p of game.players)$('lobbyPlayers').append(textNode('span','playerChip',p.name+(p.id===game.host?' 👑':'')));
 $('hostStart').classList.toggle('hidden',!host());$('waitingHost').classList.toggle('hidden',host());
 $('startGame').disabled=game.players.length<3;
}
function renderDrawing(){
 const t=task(),done=t?.already===true;
 $('drawingPrompt').textContent=t?.prompt||'Waiting for your private prompt…';
 $('submitArt').classList.toggle('hidden',done);$('artDone').classList.toggle('hidden',!done);
 $('drawingCount').textContent=(game.done||0)+' / '+game.total+' drawings submitted';
 $('toolBar').style.opacity=done?.5:1;
}
function renderSlogans(){
 const done=task()?.already===true;
 $('submitSlogans').classList.toggle('hidden',done);$('sloganDone').classList.toggle('hidden',!done);
 $('sloganOne').disabled=done;$('sloganTwo').disabled=done;
 $('sloganCount').textContent=(game.done||0)+' / '+game.total+' players submitted slogans';
}
function duelCard(shirtData,buttonText,disabled,winning){
 const wrapper=textNode('div','battleCard'+(winning===true?' winner':winning===false?' loser':''));
 if(shirtData){
  wrapper.append(shirtView(shirtData));
  const title=textNode('p','battleName',winning===true?'🏆 WINNER':winning===false?'ELIMINATED':'MYSTERY DESIGN');
  wrapper.append(title);
  if(buttonText){
   const b=textNode('button','btn main',buttonText);b.disabled=disabled;
   b.onclick=()=>call('vote',{id:shirtData.id},()=>{
    privateTask={...task(),stage:'duel',already:true};renderDuel();
   });
   wrapper.append(b);
  }
 }
 return wrapper;
}
function battleRender(root,left,right,canVote,already,winner){
 $(root).replaceChildren();
 $(root).append(
  duelCard(left,canVote?'Vote for this shirt':null,already||!canVote,winner===undefined?undefined:left?.id===winner),
  textNode('div','vs','VS'),
  duelCard(right,canVote?'Vote for this shirt':null,already||!canVote,winner===undefined?undefined:right?.id===winner)
 );
}
function renderHistory(id){
 const root=$(id);root.replaceChildren();
 if(!game.history?.length){root.append(textNode('p','help','First matchup is underway!'));return}
 for(const h of game.history.slice(-15)){
  root.append(textNode('div','matchLine','Round '+h.round+': '+h.left+' vs '+h.right+' → '+h.winner+' advances'));
 }
}
function renderDuel(){
 const t=task(),already=t?.already===true,canVote=t?.canVote===true;
 const d=game.duel;if(!d)return;
 $('duelHeading').textContent='ROUND '+game.round+' / '+game.totalRounds+' · SHIRT DUEL';
 $('duelInstruction').textContent=canVote?'Pick the shirt you would actually wear. You only get ONE vote.':'One of these is your artwork — you cannot vote in this matchup.';
 battleRender('duelGrid',d.left,d.right,canVote,already);
 $('voteStatus').textContent=(d.voters||0)+' / '+(d.eligible||0)+' votes locked'+(already?' · You voted!':'');
 renderHistory('duelHistory');
}
function renderReveal(){
 const result=game.result;if(!result)return;
 battleRender('resultGrid',result.left,result.right,false,true,result.winner);
 const winner=result.winner===result.left.id?result.left:result.right;
 $('matchWinner').textContent=(winner?.artist||'Someone')+"'s shirt advances! "+result.votes.join(' – ')+' votes'+(result.tie?' · Tie-break!':'');
 renderHistory('revealHistory');
}
function renderChampion(){
 $('championShirt').replaceChildren();
 if(game.champion){
  $('championShirt').append(shirtView(game.champion,true));
  $('championTitle').textContent=game.champion.id===socket.id?'YOU WON!':'THE CHAMPION!';
  $('championName').textContent=(game.champion.artist||'Player')+' · '+(game.champion.slogan||'');
  $('finishReason').textContent='Winning shirt created by '+game.champion.artist+' · slogan by '+game.champion.sloganBy;
 }else{
  $('championTitle').textContent='THE GAME ENDED';
  $('championName').textContent='No champion this time';
  $('finishReason').textContent=game.finishReason||'Not enough players remained.';
 }
 $('playAgain').classList.toggle('hidden',!host());
}
function leaderboard(){
 $('scoreRows').replaceChildren();
 for(const [i,p] of game.players.entries()){
  const row=textNode('div','scoreLine'+(p.id===socket.id?' me':''));
  row.append(textNode('span','',i===0?'🥇':String(i+1)),textNode('span','name',p.name+(p.id===game.host?' ★':'')),textNode('b','',p.score.toLocaleString()));
  $('scoreRows').append(row);
 }
}
function renderProgress(){
 if(!game)return;
 if(game.stage==='drawing')$('drawingCount').textContent=(game.done||0)+' / '+game.total+' drawings submitted';
 if(game.stage==='slogans')$('sloganCount').textContent=(game.done||0)+' / '+game.total+' slogan sets submitted';
 if(game.stage==='duel'){$('voteStatus').textContent=(game.done||0)+' / '+(game.duel?.eligible||0)+' votes locked'+(task()?.already?' · You voted!':'')}
}
function render(){
 $('entry').classList.toggle('hidden',!!game);$('game').classList.toggle('hidden',!game);
 if(!game)return;
 $('roomCode').textContent=game.code;
 for(const stage of ['lobby','drawing','slogans','duel','reveal','finished'])$(stage==='finished'?'championPanel':stage==='lobby'?'lobbyPanel':stage==='drawing'?'drawingPanel':stage==='slogans'?'slogansPanel':stage==='duel'?'duelPanel':'revealPanel').classList.toggle('hidden',game.stage!==stage);
 const phaseLabel={lobby:'LOBBY',drawing:'DRAWING',slogans:'SLOGANS',duel:'SHIRT BATTLE',reveal:'RESULTS',finished:'CHAMPION'};
 $('phasePill').textContent=phaseLabel[game.stage]||game.stage;
 if(previousStage!==game.stage){
  if(game.stage==='drawing')resetArt();
  if(game.stage==='slogans'){$('sloganOne').value='';$('sloganTwo').value='';$('sloganOne').disabled=false;$('sloganTwo').disabled=false}
  previousStage=game.stage;
 }
 $('skipStage').classList.toggle('hidden',!host()||['lobby','finished'].includes(game.stage));
 if(game.stage==='lobby')renderLobby();
 else if(game.stage==='drawing')renderDrawing();
 else if(game.stage==='slogans')renderSlogans();
 else if(game.stage==='duel')renderDuel();
 else if(game.stage==='reveal')renderReveal();
 else if(game.stage==='finished')renderChampion();
 leaderboard();tick();
}
function tick(){
 if(!game?.endsAt){$('timer').textContent='';return}
 const time=Math.max(0,Math.ceil((game.endsAt-Date.now())/1000));
 $('timer').textContent=String(Math.floor(time/60)).padStart(2,'0')+':'+String(time%60).padStart(2,'0');
 $('timer').style.color=time<=15?'#ffb3b3':'#ffda59';
}
setInterval(tick,250);
colorChanged(paintColor);setTool('brush');updateUndoButtons();updatePreview();
document.querySelectorAll('.shirtSwatch').forEach(b=>b.classList.toggle('selected',b.dataset.shirt===shirtColor));
