#!/usr/bin/env node
// Infinite Race Local Auto-Combiner, using Ollama on this PC.
// Open http://127.0.0.1:38417 and watch the live dashboard.
// Existing recipes and words are downloaded from the public game's read-only catalog.
// Only a private, user-entered password is sent to the server for uploading.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {CraftPriority} from './craft-priority.mjs';
import {assessRecipe,buildCraftPrompt,looksLikeGluedWords} from './recipe-quality.mjs';

const PORT=Number(process.env.AUTOCRAFT_PORT)||38417;
const HOST='127.0.0.1';
const SAVE=path.resolve('local-recipes.jsonl');
const CATALOG_CACHE=path.resolve('local-recipe-catalog-cache.json');
const DEFAULT_SERVER='https://infinite-race.onrender.com';
const clean=x=>String(x||'').trim();
const key=(a,b)=>[clean(a).toLowerCase(),clean(b).toLowerCase()].sort().join('|');
const validName=value=>typeof value==='string'&&value.length>=2&&value.length<=55&&
 /^[A-Za-z0-9][A-Za-z0-9 '&!. -]*$/.test(value)&&value.split(' ').length<=5;
function validate(a,b,object){
 const word=clean(object?.word).replace(/\s+/g,' ');
 const emoji=clean(object?.emoji||'✨').slice(0,12)||'✨';
 if(!validName(a)||!validName(b)||!validName(word))return null;
 if(word.toLowerCase()===a.toLowerCase()||word.toLowerCase()===b.toLowerCase())return null;
 if(word.toLowerCase()===a.toLowerCase()+' '+b.toLowerCase()||word.toLowerCase()===b.toLowerCase()+' '+a.toLowerCase())return null;
 if(looksLikeGluedWords(a,b,word))return null;
 if(/^(thing|object|item|something|combination|unknown|result|nothing|undefined)$/i.test(word))return null;
 if(/(?:Tech|Corp|Labs|Solutions|Innovations)$/i.test(word.replace(/\s/g,'')))return null;
 return {a,b,word,emoji};
}
const bank=new Map(),existing=new Set(),tried=new Set(),local=new Map();
const state={running:false,loading:false,uploading:false,ready:false,model:'gemma3:4b',server:DEFAULT_SERVER,
 made:0,attempted:0,failed:0,rejected:0,uploaded:0,knownPairs:0,words:0,reachableWords:0,priorityCost:0,maxCost:8,status:'Starting...',error:null,latest:[]};
let scheduler=null,parkedPair=null;
let suspiciousWords=new Set();
let quit=false;
function addWord(x){if(validName(x))bank.set(clean(x).toLowerCase(),clean(x))}
function loadSaved(){
 if(!fs.existsSync(SAVE))return;
 for(const line of fs.readFileSync(SAVE,'utf8').split(/\r?\n/)){
  if(!line)continue;
  try{
   const row=JSON.parse(line),result=validate(row.a,row.b,row);
   if(!result)continue;
   local.set(key(result.a,result.b),result);
   addWord(result.a);addWord(result.b);addWord(result.word);
  }catch{}
 }
}
loadSaved();
function useCatalog(data){
 if(data?.version!==2||!Array.isArray(data.recipes)||data.recipes.length<100)
  throw Error('Recipe catalog is outdated; connect to the internet and refresh it to calculate crafting distances.');
 if(!Array.isArray(data.words)||!Array.isArray(data.pairs)||data.words.length<100)
  throw Error('Invalid or incomplete recipe catalog');
 bank.clear();existing.clear();tried.clear();parkedPair=null;suspiciousWords=new Set();
 for(const word of data.words)addWord(word);
 for(const pair of data.pairs){
  if(typeof pair==='string'&&pair.includes('|'))existing.add(pair);
  else if(Array.isArray(pair)&&pair.length===2)existing.add(key(pair[0],pair[1]));
 }
 const graph=data.recipes.slice();
 // Do not let obvious junk previously saved/uploaded by older versions
 // become ingredients for yet more invented concepts. Keep existing recipes
 // recorded so they're still skipped, but exclude those results as inputs.
 for(const row of graph)if(Array.isArray(row)&&row.length>=3&&looksLikeGluedWords(row[0],row[1],row[2]))
  suspiciousWords.add(clean(row[2]).toLowerCase());
 for(const [pair,row] of local){
  if(!existing.has(pair))graph.push([row.a,row.b,row.word]);
  existing.add(pair);addWord(row.a);addWord(row.b);addWord(row.word);
 }
 scheduler=new CraftPriority(graph);
 state.ready=true;state.knownPairs=existing.size;state.words=bank.size;
 state.reachableWords=scheduler.reachable;state.priorityCost=0;
}
async function catalog(server){
 if(state.loading)throw Error('Catalog is already loading');
 if(state.running)throw Error('Pause generating before refreshing the catalog');
 state.loading=true;state.status='Downloading all existing recipe pairs and words...';state.error=null;
 try{
  const response=await fetch(server+'/api/recipes/catalog',{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error('Catalog endpoint returned HTTP '+response.status);
  const data=await response.json();
  if(data.words?.length<100||data.pairs?.length<100)throw Error('Catalog is incomplete');
  useCatalog(data);
  fs.writeFileSync(CATALOG_CACHE,JSON.stringify(data));
  state.status='Catalog loaded: '+existing.size.toLocaleString()+' known pairs and '+bank.size.toLocaleString()+' words';
 }catch(error){
  if(fs.existsSync(CATALOG_CACHE)){
   try{useCatalog(JSON.parse(fs.readFileSync(CATALOG_CACHE,'utf8')));state.status='Using previous saved catalog';state.error='Live catalog unavailable: '+error.message}
   catch{state.error=error.message;state.status='Could not read existing recipes';state.ready=false}
  }else{state.error=error.message;state.status='Could not load recipe database';state.ready=false}
 }finally{state.loading=false;state.knownPairs=existing.size;state.words=bank.size}
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function nextPair(){
 if(!scheduler)return null;
 const candidate=parkedPair||scheduler.nextPair(existing,tried,suspiciousWords);
 if(!candidate)return null;
 if(state.maxCost>0&&candidate.totalCrafts>state.maxCost){
  parkedPair=candidate;
  state.status='Finished all available pairs needing '+state.maxCost+' crafts or fewer. Raise the difficulty limit to keep going.';
  return null;
 }
 parkedPair=null;
 state.priorityCost=candidate.totalCrafts;
 return {...candidate,a:bank.get(candidate.a)||candidate.a,b:bank.get(candidate.b)||candidate.b};
}
function note(row){
 state.latest.unshift({a:row.a,b:row.b,word:row.word,emoji:row.emoji,when:new Date().toISOString()});
 state.latest.length=Math.min(state.latest.length,15);
}
async function generate(){
 while(state.running&&!quit){
  const pair=nextPair();
  if(!pair){if(!state.status.startsWith('Finished all available pairs'))state.status='No more reachable pairs to explore. Refresh the catalog or try a higher difficulty limit.';state.running=false;break}
  tried.add(pair.pair);
  state.attempted++;
  state.status='Combining '+pair.a+' + '+pair.b+' · shortest paths: '+pair.costA+' + '+pair.costB+' crafts';
  try{
   let output=null,rejection='';
   // Two attempts maximum. Bad word-mashups are *discarded*, not saved,
   // and the retry explicitly explains what was wrong.
   for(let attempt=0;attempt<2&&state.running;attempt++){
    if(attempt)state.status='Rejected bad answer ('+rejection+'); trying a real concept for '+pair.a+' + '+pair.b;
    const response=await fetch('http://127.0.0.1:11434/api/generate',{
     method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(180000),
     body:JSON.stringify({model:state.model,prompt:buildCraftPrompt(pair.a,pair.b,rejection),
      stream:false,format:'json',keep_alive:'20m',
      options:{temperature:.3,top_p:.85,repeat_penalty:1.15,num_predict:260,num_ctx:2048}})
    });
    if(!response.ok)throw Error('Ollama returned HTTP '+response.status);
    const payload=await response.json(),raw=clean(payload.response);
    let parsed=null;
    try{parsed=JSON.parse(raw)}
    catch{
     try{const fragment=raw.match(/\{[\s\S]*\}/);parsed=fragment?JSON.parse(fragment[0]):null}
     catch{}
    }
    const assessment=assessRecipe(pair.a,pair.b,parsed);
    if(assessment.ok){
     output=assessment.recipe;
     break;
    }
    state.rejected++;
    rejection=(assessment.reason||'Malformed JSON')+
      (parsed?.word?' (previous answer: '+clean(parsed.word).slice(0,50)+')':'');
   }
   if(!output){
    state.status='Skipped '+pair.a+' + '+pair.b+': '+rejection+'. No fake result saved.';
    continue;
   }
   // Save to disk before updating the visible success counter.
   fs.appendFileSync(SAVE,JSON.stringify({...output,createdAt:new Date().toISOString(),model:state.model})+'\n');
   local.set(pair.pair,output);
   existing.add(pair.pair);
   addWord(output.word);
   scheduler.addRecipe([output.a,output.b,output.word]);
   state.made++;state.knownPairs=existing.size;state.words=bank.size;state.reachableWords=scheduler.reachable;
   state.status='Created '+output.word+' ('+(pair.totalCrafts+1)+' crafts from starters)';note({...output,totalCrafts:pair.totalCrafts+1,connection:output.connection});
  }catch(error){
   state.failed++;state.error=String(error.message||error).slice(0,130);
   if(/fetch failed|ECONNREFUSED|Ollama returned HTTP 404/.test(state.error)){state.running=false;state.status='Cannot connect to the selected Ollama model';break}
   await sleep(800);
  }
  await sleep(60);
 }
 state.running=false;
}
async function start(model,maxCost){
 if(state.running||state.loading||state.uploading)throw Error('Already busy');
 if(!state.ready)throw Error('Load the existing recipe catalog first');
 if(!/^[a-zA-Z0-9._:-]{2,80}$/.test(model))throw Error('Invalid model name');
 const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(6000)}).catch(()=>null);
 if(!r?.ok)throw Error('Ollama not running. Start Ollama and install gemma3:4b.');
 const tags=(await r.json()).models?.map(m=>m.name)||[];
 if(!tags.includes(model))throw Error('Model not installed. In Terminal run: ollama pull '+model);
 state.model=model;state.maxCost=[4,8,12,20,0].includes(Number(maxCost))?Number(maxCost):8;state.running=true;state.error=null;state.status='Exploring easiest unrecorded combinations first...';
 void generate();
}
async function upload(server,password){
 if(state.uploading||state.running)throw Error('Pause generation before uploading');
 if(!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(server))throw Error('Enter the HTTPS URL of your Infinite Race server');
 if(!password||password.length<8||password.length>500)throw Error('Enter the upload password configured on Render');
 state.uploading=true;state.status='Uploading saved recipes...';state.error=null;
 let added=0,skipped=0,rejected=0;
 try{
  const rows=[...local.values()];
  for(let i=0;i<rows.length;i+=50){
   const response=await fetch(server+'/api/recipes/import',{
    method:'POST',headers:{Authorization:'Bearer '+password,'Content-Type':'application/json'},
    signal:AbortSignal.timeout(45000),body:JSON.stringify({recipes:rows.slice(i,i+50)})
   });
   const data=await response.json().catch(()=>({error:'The server returned an invalid response'}));
   if(!response.ok||!data.ok)throw Error('Upload failed: '+(data.error||response.status));
   added+=data.accepted||0;skipped+=data.skipped||0;rejected+=data.rejected||0;
   state.status='Uploading '+Math.min(i+50,rows.length)+'/'+rows.length+' combinations';
  }
  state.uploaded+=added;
  state.status='Upload complete: '+added+' new shared recipes, '+skipped+' already known, '+rejected+' rejected';
  return {added,skipped,rejected};
 }catch(error){state.error=String(error.message||error);state.status='Upload failed';throw error}
 finally{state.uploading=false}
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function readJson(req){
 let data='';for await(const part of req){data+=part;if(data.length>16000)throw Error('Request too large')}
 return JSON.parse(data||'{}');
}
const html="<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Infinite Race — Local Auto-Combiner</title><style>\n*{box-sizing:border-box}body{background:#0d1021;color:#f7f5ff;font:15px system-ui;margin:0;min-height:100dvh;background-image:radial-gradient(ellipse at 90% 0%,#33317e33,transparent 45%)}main{max-width:1050px;margin:auto;padding:38px 20px 70px}\nsmall,.muted{color:#a8adc8}h1{font-size:clamp(32px,6vw,54px);letter-spacing:-.055em;margin:9px 0}h2{margin:0 0 10px}\n.logo{color:#75e8cd;letter-spacing:.12em;font-size:12px;font-weight:900}p{line-height:1.6;color:#c6c5db}.panel{background:#171b33;border:1px solid #343954;border-radius:22px;padding:23px;margin-top:18px}\n .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:25px 0}\n.stat{background:#1a2140;border:1px solid #353c62;border-radius:15px;padding:16px;min-width:0}.stat strong{display:block;font-size:clamp(25px,4vw,40px);margin:7px 0;color:#86f0db;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}\n.stat small{font-size:11px;text-transform:uppercase;letter-spacing:.09em;font-weight:800}\nlabel{display:block;color:#b4bddc;font-size:12px;font-weight:900;letter-spacing:.06em;margin:15px 0 7px}\ninput,select{width:100%;border:1px solid #475077;border-radius:10px;background:#10172e;color:#fff;padding:12px;font:inherit}\nbutton{border:0;border-radius:10px;padding:13px 19px;font:inherit;font-weight:900;cursor:pointer;background:#8ff3d8;color:#071d1a}\nbutton.secondary{background:#384268;color:#f7f8ff}button:disabled{opacity:.4;cursor:not-allowed}.row{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.row>div{flex:1;min-width:190px}.row button{align-self:end}\n.tag{padding:5px 10px;border-radius:30px;background:#353d60;color:#fff;font-weight:800;font-size:12px;display:inline-block}\n#activity{font-size:14px;font-weight:800;color:#ffdb84;min-height:22px;overflow-wrap:anywhere}.error{color:#ff9eb0!important}\n#feed{display:grid;gap:8px;margin-top:13px}.recipe{background:#10162a;border:1px solid #303a5a;border-radius:10px;padding:11px 13px;display:flex;justify-content:space-between;gap:12px}\n.recipe b{color:#98e8d4}.recipe{flex-wrap:wrap}.recipe .reason{flex-basis:100%;font-size:12px;color:#a6b5cf;line-height:1.45}.recipe small{color:#8c98bc}hr{border:0;border-top:1px solid #313752;margin:24px 0}.help{font-size:13px;color:#9da9cc}\n@media(max-width:700px){.stats{grid-template-columns:repeat(2,1fr)}.row button{width:100%}}\n</style></head><body><main>\n<div class=\"logo\">⚗️ INFINITE RACE · NO CLOUD AI</div>\n<h1>Local Auto-Combiner</h1>\n<p>Combines the <b>easiest-to-craft words first</b>, using shortest known paths from Water, Fire, Wind and Earth. It skips existing pairs and grows the recipe list with each result. Runs entirely on your computer using Ollama + Gemma.</p>\n<div class=\"stats\">\n <div class=\"stat\"><small>New combinations made this session</small><strong id=\"made\">0</strong></div>\n <div class=\"stat\"><small>Total saved on this PC</small><strong id=\"saved\">0</strong></div>\n <div class=\"stat\"><small>Recorded existing recipes</small><strong id=\"known\">—</strong></div>\n <div class=\"stat\"><small>Words reachable from starters</small><strong id=\"reachable\">—</strong></div>\n <div class=\"stat\"><small>Fake answers rejected</small><strong id=\"rejected\">0</strong></div>\n</div>\n<div class=\"panel\"><h2>Auto-combining <span class=\"tag\" id=\"mode\">Starting</span></h2>\n<p class=\"help\">Gemma must explain a real, existing connection. Made-up mashups get rejected and retried once. Every accepted result is saved instantly; stopping won't lose it.</p>\n<div class=\"row\"><div><label for=\"model\">Local Ollama model</label><select id=\"model\"><option value=\"gemma3:4b\">Google Gemma 3 4B (recommended)</option><option value=\"gemma3:1b\">Google Gemma 3 1B (smaller, faster)</option><option value=\"gemma3:12b\">Google Gemma 3 12B (larger)</option></select></div><div><label for=\"maxCost\">Ingredient difficulty</label><select id=\"maxCost\"><option value=\"4\">Very easy · 4 crafts or fewer</option><option value=\"8\" selected>Common · 8 crafts or fewer</option><option value=\"12\">More variety · 12 crafts</option><option value=\"20\">Deep · 20 crafts</option><option value=\"0\">No limit</option></select></div><button id=\"start\">▶ Start auto-combining</button><button class=\"secondary\" id=\"stop\">⏸ Pause</button><button class=\"secondary\" id=\"refresh\">↻ Refresh existing recipes</button></div>\n<p id=\"activity\">Loading recipe catalog...</p><p id=\"error\" class=\"error\"></p>\n</div>\n<div class=\"panel\"><h2>Latest new recipes</h2><p class=\"help\">Newly generated combinations show up here as they're saved on your PC.</p><div id=\"feed\"></div></div>\n<div class=\"panel\"><h2>Upload your recipes for everyone</h2>\n<p>When you're happy with the new combinations, upload them to your shared Infinite Race database. Enter the upload password that matches <code>RECIPE_IMPORT_TOKEN</code> in Render.</p>\n<div class=\"row\"><div><label for=\"password\">Upload password</label><input id=\"password\" type=\"password\" autocomplete=\"off\" placeholder=\"Enter your upload password\"></div><div><label for=\"server\">Your Infinite Race website</label><input id=\"server\" value=\"https://infinite-race.onrender.com\" spellcheck=\"false\"></div><button id=\"upload\">↑ Upload saved combinations</button></div>\n<p class=\"help\">Your password is sent only to your specified HTTPS game server when you click Upload. It isn't saved locally or placed in GitHub. You must configure the same password on Render first.</p>\n<p id=\"uploadResult\" class=\"help\"></p></div>\n<p class=\"help\">First install Ollama and run <code>ollama pull gemma3:4b</code>. The catalog includes actual recipe results so it can rank words by the fewest crafts needed. It's cached after downloading. Generation itself sends <b>no requests to Gemini or other cloud AI services</b>.</p>\n</main><script>\nconst $=id=>document.getElementById(id);let current=null;\nconst count=n=>Number(n||0).toLocaleString();\nasync function post(route,body={}){\n const response=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});\n const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Request failed');return result;\n}\n$('start').onclick=()=>post('start',{model:$('model').value,maxCost:Number($('maxCost').value)}).catch(e=>$('error').textContent=e.message);\n$('stop').onclick=()=>post('stop').catch(e=>$('error').textContent=e.message);\n$('refresh').onclick=()=>post('refresh').catch(e=>$('error').textContent=e.message);\n$('upload').onclick=async()=>{\n $('uploadResult').textContent='Uploading...';\n try{const result=await post('upload',{password:$('password').value,server:$('server').value});\n $('uploadResult').textContent='Added '+count(result.added)+' new public recipes · '+count(result.skipped)+' already existed · '+count(result.rejected)+' invalid';\n $('password').value='';\n }catch(e){$('uploadResult').textContent=e.message}\n};\nasync function tick(){\n try{\n  const r=await(await fetch('/api/status',{cache:'no-store'})).json();current=r;\n  $('made').textContent=count(r.made);$('saved').textContent=count(r.locallySaved);\n  $('known').textContent=count(r.knownPairs);$('reachable').textContent=count(r.reachableWords);$('rejected').textContent=count(r.rejected);\n  $('mode').textContent=r.running?'RUNNING':r.loading?'LOADING':r.uploading?'UPLOADING':r.ready?'READY':'WAITING';\n  $('maxCost').disabled=!!r.running;\n  $('start').disabled=!!(r.running||r.loading||r.uploading||!r.ready);\n  $('stop').disabled=!r.running;$('refresh').disabled=!!(r.loading||r.running||r.uploading);\n  $('upload').disabled=!!(r.loading||r.running||r.uploading||!r.locallySaved);\n  $('activity').textContent=r.status||'Ready';\n  $('error').textContent=r.error||'';\n  $('feed').replaceChildren();\n  for(const p of r.latest){\n   const line=document.createElement('div');line.className='recipe';\n   const left=document.createElement('span');left.textContent=p.a+' + '+p.b+(Number.isInteger(p.totalCrafts)?' · '+p.totalCrafts+' crafts':'');\n   const right=document.createElement('b');right.textContent=(p.emoji||'✨')+' '+p.word;\n   line.append(left,right);if(p.connection){const why=document.createElement('span');why.className='reason';why.textContent=p.connection;line.append(why)}$('feed').append(line);\n  }\n }catch(e){$('error').textContent='Local generator connection lost'}\n}\nsetInterval(tick,900);tick();\n</script></body></html>";
const server=http.createServer(async(req,res)=>{
 const host=req.headers.host||'';
 if(host!==HOST+':'+PORT&&host!=='localhost:'+PORT)return json(res,403,{error:'Invalid local host'});
 const url=new URL(req.url,'http://'+HOST+':'+PORT);
 if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return}
 if(req.method==='GET'&&url.pathname==='/api/status'){return json(res,200,{...state,locallySaved:local.size})}
 if(req.method!=='POST'||!['/api/start','/api/stop','/api/upload','/api/refresh'].includes(url.pathname))return json(res,404,{error:'Not found'});
 if(req.headers.origin!=='http://'+HOST+':'+PORT)return json(res,403,{error:'Local dashboard only'});
 try{
  const data=await readJson(req);
  if(url.pathname==='/api/start')await start(clean(data.model||'gemma3:4b'),data.maxCost);
  if(url.pathname==='/api/stop'){state.running=false;state.status='Pausing after current combination...'}
  if(url.pathname==='/api/refresh'){state.server=DEFAULT_SERVER;await catalog(DEFAULT_SERVER)}
  let result=null;
  if(url.pathname==='/api/upload')result=await upload(clean(data.server||DEFAULT_SERVER),String(data.password||''));
  return json(res,200,{ok:true,...(result||{})});
 }catch(error){return json(res,400,{ok:false,error:String(error.message||error).slice(0,250)})}
});
server.listen(PORT,HOST,()=>{
 console.log('\nInfinite Race Local Auto-Combiner: http://'+HOST+':'+PORT);
 console.log('All AI generation runs through Ollama on this computer. No Gemini API needed.');
 console.log('Saved recipes: '+local.size+' | Open the dashboard above in your browser.');
 void catalog(DEFAULT_SERVER);
});
