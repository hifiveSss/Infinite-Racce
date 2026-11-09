// Runs entirely in the visitor's browser, behind a WebGPU worker.
// Smart model for capable devices, light model as a resource fallback.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels = false;
const MODELS = {
  smart: {id:'onnx-community/Qwen3-1.7B-ONNX', dtype:'q4f16', label:'Smart · Qwen3 1.7B'},
  light: {id:'onnx-community/Qwen3-0.6B-ONNX', dtype:'q4', label:'Light · Qwen3 0.6B'},
};
let generator = null, activeTier = null, loadingPromise = null;
let tier = 'smart';
const send = data => self.postMessage(data);
function formatErr(e){return String(e?.message || e || 'Unknown model error').slice(0,280)}
async function load(){
  if(generator) return generator;
  if(loadingPromise) return loadingPromise;
  loadingPromise=(async()=>{
    const order=tier==='smart' ? ['smart','light'] : ['light'];
    let lastError;
    for(const choice of order){
      const model=MODELS[choice];
      try {
        send({type:'status',message:`Loading ${model.label} (first visit downloads model files)…`});
        const pipe=await pipeline('text-generation', model.id, {
          device:'webgpu',dtype:model.dtype,
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
        send({type:'status',message:`${model.label} unavailable: ${formatErr(err)}${choice==='smart'?' — trying light AI…':''}`});
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
    {role:'user',content:'Water + Fire /no_think'},
    {role:'assistant',content:'{"word":"Steam","emoji":"💨"}'},
    {role:'user',content:'Book + Electricity /no_think'},
    {role:'assistant',content:'{"word":"E-reader","emoji":"📱"}'},
    {role:'user',content:`${a} + ${b} /no_think`},
  ];
  let last;
  for(let attempt=0;attempt<2;attempt++){
    const output=await model(prompt, {max_new_tokens:78,temperature:attempt?0.85:0.55,do_sample:true,repetition_penalty:1.13});
    try{return parse(generatedText(output),a,b)}catch(err){last=err}
  }
  throw last;
}
// Serialize operations so two simultaneous crafts don't compete for GPU memory.
let queue=Promise.resolve();
self.onmessage=e=>{
  const {type,id,a,b,preferredTier}=e.data||{};
  if(type==='load'){
    if(preferredTier==='light'||preferredTier==='smart')tier=preferredTier;
    queue=queue.then(()=>load()).catch(err=>send({type:'status',message:formatErr(err)}));
    return;
  }
  if(type!=='combine')return;
  if(preferredTier==='light'||preferredTier==='smart')tier=preferredTier;
  queue=queue.then(async()=>{
    try{send({type:'status',message:generator?`Crafting with ${MODELS[activeTier].label}…`:'Preparing local AI…'});
      send({type:'result',id,...await combine(String(a||''),String(b||''))});
    }catch(err){send({type:'error',id,message:formatErr(err)})}
  });
};
