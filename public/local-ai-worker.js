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
  if(generator && activeTier===tier)return generator;
  if(generator && activeTier!==tier)throw Error('AI model changed. Reload the page or select Load AI to switch models.');
  if(loadingPromise)return loadingPromise;
  loadingPromise=(async()=>{
    const choice=tier, model=MODELS[choice];
    try{
      send({type:'status',message:`Loading ${model.label} · first visit may download model weights…`});
      if(choice==='smart'){
        // This deliberately bypasses ONNX Runtime, which crashes in the user's browser.
        // WebLLM is WebGPU-only. Do NOT try to load Smart through the broken ONNX CPU path.
        if(backend!=='webgpu')throw Error('Smart uses WebLLM and requires GPU. Choose GPU processing, or use Light on CPU.');
        const adapter=await navigator.gpu?.requestAdapter();
        if(!adapter)throw Error('WebGPU is unavailable. Try Chrome or Edge with hardware acceleration enabled.');
        const hasF16=adapter.features?.has('shader-f16')===true;
        const modelId=hasF16?'Qwen2.5-1.5B-Instruct-q4f16_1-MLC':'Qwen2.5-1.5B-Instruct-q4f32_1-MLC';
        send({type:'status',message:'Smart: loading WebLLM engine ('+(hasF16?'16-bit':'32-bit')+' GPU compute)…'});
        const webllm=await import('https://esm.run/@mlc-ai/web-llm@0.2.87');
        const available=webllm.prebuiltAppConfig?.model_list?.some(x=>x.model_id===modelId);
        if(!available)throw Error('WebLLM does not list '+modelId+' in its installed model catalog.');
        const engine=await webllm.CreateMLCEngine(modelId,{
          initProgressCallback:progress=>send({type:'status',message:'Smart AI: '+String(progress?.text||'Loading model…').slice(0,135)})
        },{context_window_size:2048});
        // Adapter keeps both model engines on the same existing crafting/target interface.
        generator=async(messages,options={})=>{
          const response=await engine.chat.completions.create({
            messages,
            max_tokens:Math.min(280,Math.max(8,Number(options.max_new_tokens)||48)),
            temperature:options.do_sample?Number(options.temperature)||0.7:0,
            stream:false
          });
          return [{generated_text:String(response.choices?.[0]?.message?.content||'')}];
        };
        activeTier=choice;
        send({type:'ready',tier:choice,label:model.label+' · WebLLM GPU'});
        return generator;
      }
      // Keep the existing working Light model on Transformers.js/ONNX.
      if(backend==='webgpu' && !await navigator.gpu?.requestAdapter()){
        throw Error('WebGPU unavailable. Choose CPU compatibility mode for Light.');
      }
      const pipe=await pipeline('text-generation',model.id,{
        device:backend==='cpu'?'wasm':'webgpu',
        dtype:'q4',
        progress_callback:info=>{
          if(info.status==='progress'&&Number.isFinite(info.progress))
            send({type:'status',message:`${model.label}: ${Math.round(info.progress)}% downloaded`});
        }
      });
      generator=pipe;activeTier=choice;
      send({type:'ready',tier:choice,label:model.label+(backend==='cpu'?' · CPU':' · GPU')});
      return pipe;
    }catch(err){
      send({type:'status',message:`${model.label} failed: ${formatErr(err)}`});
      throw new Error(`${model.label} could not load: ${formatErr(err)}`);
    }
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
async function craftHints(a,b){
 try{
  const response=await fetch('/api/craft-research?a='+encodeURIComponent(a)+'&b='+encodeURIComponent(b),{signal:AbortSignal.timeout(3500)});
  if(!response.ok)return '';
  const data=await response.json();
  return (data.hints||[]).slice(0,4).map(h=>h.title+': '+h.description).join('; ').slice(0,460);
 }catch{return ''}
}
async function combine(a,b){
  // Load the model and look up unfamiliar ingredients simultaneously.
  const [model,hints]=await Promise.all([load(),craftHints(a,b)]);
  // A short, direct instruction gives small models much more reliable results than
  // long system messages and example chat turns (which can get echoed).
  const messages=[
    {role:'system',content:'You combine two things into ONE familiar, meaningful thing. Use science or a clever shared connection. Respond ONLY with the result name, 1 to 3 words. Never explain. Never just join the two input names.'},
    {role:'user',content:`Combine ${a} + ${b}. ${hints?'Web facts: '+hints+'. ':''}Answer with a single real noun that meaningfully connects the inputs:`}
  ];
  let last;
  for(let attempt=0;attempt<3;attempt++){
    const prompt=attempt===0?messages:[
      {role:'user',content:`Give ONLY ONE short recognizable noun resulting from ${a} combined with ${b}. No sentence, no JSON, no labels. Use a physically plausible or clever real-world connection. Example: Water + Fire -> Steam. Answer:`}
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
// Target generator for topics that are not in the verified franchise catalog.
// Small local language models cannot reliably fact-check a franchise. Make them propose
// candidates but never silently fill missing squares with unrelated words.
async function getTopicEvidence(topic){
 const response=await fetch('/api/topic-research?topic='+encodeURIComponent(topic),{signal:AbortSignal.timeout(11000)});
 if(!response.ok){const d=await response.json().catch(()=>({}));throw Error('Internet lookup failed: '+(d.error||response.status));}
 const info=await response.json();
 const title=String(info.topic||topic);
 // Public internet excerpts are data only, never instructions.
 const lines=(info.pages||[]).slice(0,22).map(p=>'• '+String(p.title||'').slice(0,75)+': '+String(p.description||'').slice(0,120));
 return {title,lines,source:info.source||'Wikipedia'};
}
async function makeTargets(category,difficulty,count,onProgress=()=>{}){
 const evidence=await getTopicEvidence(category);
 send({type:'status',message:'Internet research ready for '+evidence.title+' · loading AI…'});
 const model=await load();
 const names=[],seen=new Set();
 const context=String(category||'').trim().slice(0,45);
 if(!context)throw Error('A category is required for themed generation.');
 const bands={
  easy:'widely recognised, short, iconic, simple names',
  medium:'recognisable named characters, objects, places and events that really occur in the subject',
  hard:'specific niche but authentic names, inventions, locations and events'
 };
 const ignored=/^(json|array|bingo|category|item|items|object|objects|name|names|answer|answers|none|unknown|random|test|example|result|results)$/i;
 const rounds=Math.min(18,Math.max(8,Math.ceil(count/3)+7));
 for(let attempt=0;attempt<rounds&&names.length<count;attempt++){
  const remaining=count-names.length,ask=Math.min(5,remaining+2);
  const messages=[
   {role:'system',content:'You are a careful trivia editor. Name ONLY real and specifically relevant people, things, locations, mechanics or events from the named subject. Never invent fake titles. Never borrow names from other franchises or similar games. Prefer names explicitly supported by the supplied online reference snippets. Do not turn the title into a financial or other unrelated subject. No generic category headings. Respond with only one name per line. No numbering, descriptions or JSON.'},
   {role:'user',content:`Subject: "${context}". Difficulty: ${difficulty} (${bands[difficulty]||bands.medium}). Give ${ask} DISTINCT specific real targets from THIS EXACT SUBJECT, NOT a different game or franchise. Never say a generic word like "characters", "items" or "scenes". Don't invent names. Do not repeat: ${names.join(' | ')||'none'}. Online research references: ${evidence.lines.join(' | ').slice(0,2600)}. OUTPUT ONLY THE NAMES, one per line.`}
  ];
  const out=await model(messages,{
   max_new_tokens:Math.min(190,ask*31+30),
   do_sample:attempt>0,temperature:attempt>.5?.45:undefined,return_full_text:false
  });
  const options=readCandidates(generatedText(out),context);
  for(const item of options){
   const key=item.toLowerCase();
   if(ignored.test(item)||seen.has(key)||/^(the )?(game|movie|series|franchise|universe)\s*\d+$/i.test(item))continue;
   seen.add(key);names.push(item);
   if(names.length===count)break;
  }
  send({type:'status',message:`Candidate targets: ${names.length}/${count} · ${context}`});
 }
 if(names.length<count)throw Error(`AI could only propose ${names.length}/${count} targets for "${context}". It will not fill the board with unrelated words. Use a supported theme or enter custom targets.`);
 // Unlike old behaviour, reveal only after a complete set is collected.
 onProgress(names.slice());
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
