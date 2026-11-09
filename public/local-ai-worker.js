// Runs entirely in the visitor's browser, behind a WebGPU worker.
// Verified Qwen2.5 instruct models; explicit tier selection is never silently downgraded.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels = false;
// Single-threaded WASM avoids failures in browsers without cross-origin isolation.
env.backends.onnx.wasm.numThreads = 1;
env.useBrowserCache = true;
const MODELS = {
  smart: {id:'onnx-community/Qwen2.5-1.5B-Instruct', dtype:'q4f16', label:'Smart · Qwen2.5 1.5B'},
  light: {id:'onnx-community/Qwen2.5-0.5B-Instruct', dtype:'q4f16', label:'Light · Qwen2.5 0.5B'},
};
let generator = null, activeTier = null, loadingPromise = null;
let tier = 'smart';
let backend = 'webgpu';
const send = data => self.postMessage(data);
function formatErr(e){return String(e?.message || e || 'Unknown model error').slice(0,280)}
async function load(){
  if(generator) return generator;
  if(loadingPromise) return loadingPromise;
  loadingPromise=(async()=>{
    const order=[tier];
    let lastError;
    for(const choice of order){
      const model=MODELS[choice];
      try {
        send({type:'status',message:`Loading ${model.label} (first visit downloads model files)…`});
        if(backend==='webgpu'){
          const adapter=await navigator.gpu?.requestAdapter();
          if(!adapter)throw Error('No compatible WebGPU adapter. Try CPU compatibility mode or enable hardware acceleration.');
        }
        // q4 is the format in the official Transformers.js Qwen2.5 browser example.
        const pipe=await pipeline('text-generation', model.id, {
          device:backend==='cpu'?'wasm':'webgpu',dtype:'q4',
          progress_callback:info=>{
            if(info.status==='progress'&&Number.isFinite(info.progress))
              send({type:'status',message:`${model.label}: ${Math.round(info.progress)}% downloaded`});
          }
        });
        generator=pipe;activeTier=choice;
        send({type:'ready',tier:choice,label:model.label + (backend==='cpu'?' (CPU)':' (GPU)')});
        return pipe;
      }catch(err){
        lastError=err;
        send({type:'status',message:`${model.label} unavailable: ${formatErr(err)} — select another model or try Chrome/Edge after restarting your browser`});
      }
    }
    throw new Error('Could not load a browser model: '+formatErr(lastError));
  })();
  try{return await loadingPromise}finally{loadingPromise=null}
}
function generatedText(output){
  const value=output?.[0]?.generated_text;
  if(typeof value==='string')return value;
  if(Array.isArray(value)){
    const assistant=[...value].reverse().find(v=>v?.role==='assistant'&&typeof v.content==='string');
    if(assistant)return assistant.content;
    return String(value.at(-1)?.content||'');
  }
  return String(value?.content||value||'');
}
function parse(text,a,b){
  let cleaned=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/<\|[^>]+\|>/g,'').replace(/```(?:json)?/gi,'').trim();
  const objects=[...cleaned.matchAll(/\{[^{}]{2,250}\}/g)];
  let obj=null;
  for(const item of objects.reverse()){try{let v=JSON.parse(item[0]);if(v.word||v.result||v.item){obj=v;break}}catch{}}
  let word=String(obj?.word||obj?.result||obj?.item||'').trim();
  if(!word){
    const lines=cleaned.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    word=lines.at(-1)||'';
    word=word.replace(/^(?:assistant|result|answer|item|output)\s*:\s*/i,'').replace(/^['"`]+|['"`]+$/g,'');
    word=word.split(/\s+[—–-]\s+|\s+because\s+|\s+is\s+/i)[0];
  }
  word=word.replace(/^[*#\-\s]+/,'').replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();
  // This is an English-language game: never save mixed-script / corrupted model outputs.
  if(!/^[A-Za-z0-9][A-Za-z0-9 '&\-!.]*$/.test(word)||word.length>44||word.split(' ').length>4||/(.)\1{4,}/i.test(word))throw Error('AI output was garbled: '+cleaned.slice(-70));
  const norm=v=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if([a,b,`${a} ${b}`,`${b} ${a}`,`${a} and ${b}`,`${b} and ${a}`].some(v=>norm(v)===norm(word)))throw Error('AI repeated an ingredient or joined the inputs');
  return {word,emoji:String(obj?.emoji||'✨').trim().slice(0,12)||'✨'};
}
async function combine(a,b){
  const model=await load();
  // A short, direct instruction gives small models much more reliable results than
  // long system messages and example chat turns (which can get echoed).
  const messages=[
    {role:'system',content:'You combine two things into ONE familiar, meaningful thing. Use science or a clever shared connection. Respond ONLY with the result name, 1 to 3 words. Never explain. Never just join the two input names.'},
    {role:'user',content:`Combine ${a} + ${b}. Answer with a single real noun:`}
  ];
  let last;
  for(let attempt=0;attempt<3;attempt++){
    const prompt=attempt===0?messages:[
      {role:'user',content:`Give ONLY ONE short recognizable noun resulting from ${a} combined with ${b}. No sentence, no JSON, no labels. Example: Water + Fire -> Steam. Answer:`}
    ];
    const output=await model(prompt,{max_new_tokens:attempt?36:42,do_sample:attempt>0,temperature:attempt?0.7:undefined,return_full_text:false});
    try{return parse(generatedText(output),a,b)}catch(err){last=err}
  }
  throw last||Error('AI did not produce a useful result');
}
// Target selection is deliberately stricter than craft results. A category label is NOT a target.
const vagueTarget=/\b(characters?|scenes?|items?|things?|places?|concepts?|objects?|weapons?|vehicles?|people|technology|world|universe|genre|theme|elements?|creatures?|locations?|ideas?|equipment)\b/i;
function cleanTarget(v,category){
 const w=String(v||'').replace(/^[\s*#0-9.)-]+/,'').replace(/^['"`]+|['"`]+$/g,'').replace(/\s+/g,' ').trim();
 if(w.length<3||w.length>39||w.split(' ').length>4||!/^[A-Za-z0-9][A-Za-z0-9 '&-]*$/.test(w)||vagueTarget.test(w))return null;
 if(['water','fire','wind','earth'].includes(w.toLowerCase()))return null;
 if(w.toLowerCase()===category.toLowerCase())return null;
 return w;
}
function readCandidates(text,category){
 let arr=[];const body=String(text||'').replace(/<\|[^>]+\|>/g,'');
 for(const match of body.matchAll(/\[[\s\S]*?\]/g)){
  try{const parsed=JSON.parse(match[0]);if(Array.isArray(parsed))arr.push(...parsed)}catch{}
 }
 if(!arr.length){
  arr=body.split(/\r?\n|[,;]/).map(x=>x.replace(/^\s*[-*0-9.)]+\s*/,'').trim());
 }
 return arr.map(x=>cleanTarget(x,category)).filter(Boolean);
}
async function makeTargets(category,difficulty,count,onProgress=()=>{}){
 const model=await load();const names=[];const seen=new Set();
 // A small model can reliably provide a few targets per response, not 25 at once.
 for(let attempt=0;attempt<Math.max(3,Math.ceil(count/4)+3)&&names.length<count;attempt++){
  const remaining=count-names.length,ask=Math.min(6,remaining+2);
  const samples={easy:'Stormtrooper, Droid, Lightsaber',medium:'Millennium Falcon, Darth Vader, Death Star',hard:'Darth Plagueis, Mandalorian, Star Destroyer'};
  const messages=[
   {role:'system',content:'You are making a bingo game. Return only a JSON array of distinct SPECIFIC proper names, individual people, physical objects, places or named events from the requested franchise/theme. NO category titles, NO explanations, NO generic words like characters or scenes. English language only.'},
   {role:'user',content:`Theme: ${category}. Difficulty: ${difficulty}. Give ${ask} actual DISTINCT things that exist in this theme. For example, Star Wars medium targets could be ${samples[difficulty]}. Do not give a category name such as "Star Wars Characters" or "Star Wars Scenes". Already used: ${names.join(', ')||'(none)'}. Output a JSON string array only.`}
  ];
  const out=await model(messages,{max_new_tokens:Math.min(260,ask*32+50),do_sample:attempt>0,temperature:attempt>0?.55:undefined,return_full_text:false});
  const options=readCandidates(generatedText(out),category);
  for(const item of options){const key=item.toLowerCase();if(!seen.has(key)){seen.add(key);names.push(item);if(names.length===count)break}}
  onProgress(names.slice());
  send({type:'status',message:`Prepared ${names.length}/${count} valid themed targets…`});
 }
 if(names.length<count)throw Error(`Prepared ${names.length}/${count} good targets. Try fewer bingo squares, a different theme or custom targets.`);
 return names.slice(0,count);
}
// Serialize requests to avoid competing for GPU memory.
let queue=Promise.resolve();
self.onmessage=e=>{
  const {type,id,a,b,preferredTier}=e.data||{};
  if(type==='load'){
    if(preferredTier==='light'||preferredTier==='smart')tier=preferredTier;
    backend=e.data.backend==='cpu'?'cpu':'webgpu';
    queue=queue.then(()=>load()).catch(err=>send({type:'loadError',message:formatErr(err)}));
    return;
  }
  if(type!=='combine' && type!=='targets')return;
  if(preferredTier==='light'||preferredTier==='smart')tier=preferredTier;
  backend=e.data.backend==='cpu'?'cpu':'webgpu';
  queue=queue.then(async()=>{
    try{send({type:'status',message:generator?`Crafting with ${MODELS[activeTier].label}…`:'Preparing local AI…'});
      if(type==='targets')send({type:'targetsResult',id,targets:await makeTargets(String(e.data.category||'').slice(0,45),String(e.data.difficulty||'medium'),Math.min(25,Math.max(1,Number(e.data.count)||1)),words=>send({type:'targetsProgress',id,targets:words}))});
      else send({type:'result',id,...await combine(String(a||''),String(b||''))});
    }catch(err){send({type:'error',id,message:formatErr(err)})}
  }).catch(err=>send({type:'error',id,message:formatErr(err)}));
};
