// Runs entirely in the visitor's browser, behind a WebGPU worker.
// Verified Qwen2.5 instruct models; explicit tier selection is never silently downgraded.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels = false;
const MODELS = {
  smart: {id:'onnx-community/Qwen2.5-1.5B-Instruct', dtype:'q4f16', label:'Smart · Qwen2.5 1.5B'},
  light: {id:'onnx-community/Qwen2.5-0.5B-Instruct', dtype:'q4f16', label:'Light · Qwen2.5 0.5B'},
};
let generator = null, activeTier = null, loadingPromise = null;
let tier = 'smart';
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
        const adapter=await navigator.gpu?.requestAdapter();
        if(!adapter)throw Error('No compatible WebGPU adapter. Enable hardware acceleration and reload in Chrome or Edge.');
        const fp16=adapter.features.has('shader-f16');
        const pipe=await pipeline('text-generation', model.id, {
          device:'webgpu',dtype:fp16?model.dtype:'q4',
          progress_callback:info=>{
            if(info.status==='progress'&&Number.isFinite(info.progress))
              send({type:'status',message:`${model.label}: ${Math.round(info.progress)}% downloaded`});
          }
        });
        generator=pipe;activeTier=choice;
        send({type:'ready',tier:choice,label:model.label});
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
  if(Array.isArray(value))return String(value.at(-1)?.content||'');
  return String(value||'');
}
function parse(text,a,b){
  const cleaned=text.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
  let obj;
  try{obj=JSON.parse(cleaned)}catch{
    const match=cleaned.match(/\{[\s\S]*?\}/);
    if(match){try{obj=JSON.parse(match[0])}catch{}}
  }
  let word=String(obj?.word||'').trim();
  if(!word)word=cleaned.split('\n')[0].replace(/^(result|answer)\s*:\s*/i,'').replace(/["'`]/g,'').trim();
  word=word.replace(/\.+$/,'').replace(/\s+/g,' ').slice(0,55);
  const emoji=String(obj?.emoji||'✨').trim().slice(0,16)||'✨';
  if(!word||word.split(' ').length>5||!(/^[\p{L}\p{N}][\p{L}\p{N} '&\-!.]*$/u.test(word)))throw Error('AI returned an invalid item');
  const norm=v=>v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const joined=[norm(a+' '+b),norm(b+' '+a),norm(a+' and '+b),norm(b+' and '+a)];
  if(joined.includes(norm(word)))throw Error('AI just joined the ingredient names');
  return {word,emoji};
}
async function combine(a,b){
  const model=await load();
  const prompt=[
    {role:'system',content:'You are an expert Infinite Craft-style combination engine. For two concepts, invent ONE satisfying, recognizable noun, proper name, invention or natural phenomenon that connects BOTH ideas. Favor physical reactions, causality, shared attributes, cultural references, then clever associations. Be creative but intuitive. NEVER copy or concatenate ingredient names. No explanations, no thinking. Output strictly compact JSON {"word":"Steam","emoji":"💨"}. Use one appropriate Unicode emoji.'},
    {role:'user',content:'Water + Fire'},
    {role:'assistant',content:'{"word":"Steam","emoji":"💨"}'},
    {role:'user',content:'Book + Electricity'},
    {role:'assistant',content:'{"word":"E-reader","emoji":"📱"}'},
    {role:'user',content:`${a} + ${b}`},
  ];
  let last;
  for(let attempt=0;attempt<2;attempt++){
    const output=await model(prompt, {max_new_tokens:78,temperature:attempt?0.85:0.55,do_sample:true,repetition_penalty:1.13});
    try{return parse(generatedText(output),a,b)}catch(err){last=err}
  }
  throw last;
}
// Serialize operations so two simultaneous crafts don't compete for GPU memory.
async function makeTargets(category,difficulty,count){
 const model=await load();
 const sample=[
  {role:'system',content:'Generate diverse real recognizable concepts for a crafting-game challenge. They must be directly related to the requested theme, and avoid generic filler. Reply ONLY a JSON array of short nouns or noun phrases. No explanations.'},
  {role:'user',content:`Give ${count} DISTINCT ${difficulty} difficulty crafting targets for the theme: ${category}. Easy: common tangible things, medium: recognizable inventions/creatures/places, hard: specialised ideas. JSON array only.`}
 ];
 const out=await model(sample,{max_new_tokens:Math.min(750,Math.max(180,count*25)),do_sample:false});
 const txt=generatedText(out),match=txt.match(/\[[\s\S]*?\]/);
 if(!match)throw Error('AI did not return a themed target list. Try again.');
 const arr=JSON.parse(match[0]);
 const cleaned=[...new Set(arr.map(x=>String(x).trim()).filter(x=>x.length>1&&x.length<=48&&/^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(x)&&!['water','fire','wind','earth'].includes(x.toLowerCase())))];
 if(cleaned.length<count)throw Error(`AI only prepared ${cleaned.length}/${count} usable targets. Retry or use custom targets.`);
 return cleaned.slice(0,count);
}
let queue=Promise.resolve();
self.onmessage=e=>{
  const {type,id,a,b,preferredTier}=e.data||{};
  if(type==='load'){
    if(preferredTier==='light'||preferredTier==='smart')tier=preferredTier;
    queue=queue.then(()=>load()).catch(err=>send({type:'status',message:formatErr(err)}));
    return;
  }
  if(type!=='combine' && type!=='targets')return;
  if(preferredTier==='light'||preferredTier==='smart')tier=preferredTier;
  queue=queue.then(async()=>{
    try{send({type:'status',message:generator?`Crafting with ${MODELS[activeTier].label}…`:'Preparing local AI…'});
      if(type==='targets')send({type:'targetsResult',id,targets:await makeTargets(String(e.data.category||'').slice(0,45),String(e.data.difficulty||'medium'),Math.min(25,Math.max(1,Number(e.data.count)||1)))});
      else send({type:'result',id,...await combine(String(a||''),String(b||''))});
    }catch(err){send({type:'error',id,message:formatErr(err)})}
  });
};
