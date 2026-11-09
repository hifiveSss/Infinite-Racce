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
  let cleaned=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/```(?:json)?/gi,'').replace(/<\|[^>]+\|>/g,'').trim();
  // Transformers.js may include the prompt before the answer; take its LAST JSON result.
  const objects=[...cleaned.matchAll(/\{[^{}]{2,250}\}/g)];
  let obj=null;
  for(const item of objects.reverse()){try{const candidate=JSON.parse(item[0]);if(candidate.word||candidate.result||candidate.item){obj=candidate;break;}}catch{}}
  let word=String(obj?.word||obj?.result||obj?.item||'').trim();
  if(!word){
    const lines=cleaned.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    word=lines.at(-1)||'';
    word=word.replace(/^(?:assistant|result|answer|item|output)\s*:\s*/i,'').replace(/^["'`]+|["'`]+$/g,'');
    word=word.split(/\s+[—–-]\s+|\s+because\s+|\s+is\s+/i)[0];
  }
  word=word.replace(/^[*#\-\s]+/,'').replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();
  const emoji=String(obj?.emoji||'✨').trim().slice(0,16)||'✨';
  if(!word||word.length>55||word.split(' ').length>5||!/^[\p{L}\p{N}][\p{L}\p{N} '&\-!.]*$/u.test(word))throw Error('Unusable AI answer: '+cleaned.slice(-110));
  const norm=v=>v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  if([`${a} ${b}`,`${b} ${a}`,`${a} and ${b}`,`${b} and ${a}`].some(v=>norm(v)===norm(word)))throw Error('AI only joined the two input words');
  return {word,emoji};
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
async function makeTargets(category,difficulty,count){
 const model=await load();
 const sample=[
  {role:'system',content:'Generate diverse real recognizable concepts for a crafting-game challenge. They must be directly related to the requested theme, and avoid generic filler. Reply ONLY a JSON array of short nouns or noun phrases. No explanations.'},
  {role:'user',content:`Give ${count} DISTINCT ${difficulty} difficulty crafting targets for the theme: ${category}. Easy: common tangible things, medium: recognizable inventions/creatures/places, hard: specialised ideas. JSON array only.`}
 ];
 const out=await model(sample,{max_new_tokens:Math.min(750,Math.max(180,count*25)),do_sample:false,return_full_text:false});
 const txt=generatedText(out),match=txt.match(/\[[\s\S]*?\]/);
 if(!match)throw Error('AI did not return a themed target list. Try again.');
 const arr=JSON.parse(match[0]);
 const cleaned=[...new Set(arr.map(x=>String(x).trim()).filter(x=>x.length>1&&x.length<=48&&/^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(x)&&!['water','fire','wind','earth'].includes(x.toLowerCase())))];
 if(cleaned.length<count)throw Error(`AI only prepared ${cleaned.length}/${count} usable targets. Retry or use custom targets.`);
 return cleaned.slice(0,count);
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
      if(type==='targets')send({type:'targetsResult',id,targets:await makeTargets(String(e.data.category||'').slice(0,45),String(e.data.difficulty||'medium'),Math.min(25,Math.max(1,Number(e.data.count)||1)))});
      else send({type:'result',id,...await combine(String(a||''),String(b||''))});
    }catch(err){send({type:'error',id,message:formatErr(err)})}
  }).catch(err=>send({type:'error',id,message:formatErr(err)}));
};
