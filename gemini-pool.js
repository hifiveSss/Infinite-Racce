// Gemini key pool for Infinite Race. Credentials never leave the server.
// API limits are assigned by Google Cloud project, not by the string of the key.
const entries=Array.from({length:5},(_,i)=>({
 number:i+1,
 key:(process.env['GEMINI_API_KEY_'+(i+1)]||(i===0?process.env.GEMINI_API_KEY:'')||'').trim(),
 active:0,cooldownUntil:0,nextCallAt:0,limits:0,failures:0,
 health:{status:'untested',checkedAt:null,httpStatus:null,model:null,latencyMs:null}
})).filter(e=>e.key);
const slots=entries.filter((e,i,all)=>all.findIndex(other=>other.key===e.key)===i);
let next=0;
const minimumSpacing=Math.max(700,Math.min(20000,Number(process.env.GEMINI_REQUEST_SPACING_MS)||3600));
const scrub=e=>String(e?.message||e||'Gemini failed').replace(/AIza[0-9A-Za-z_-]+/g,'[redacted]').slice(0,150);
const now=()=>Date.now();
const lastUsage={success:0,failed:0,rateLimited:0,invalid:0};
export const geminiConfigured=()=>slots.length>0;
export const geminiKeyCount=()=>slots.length;
export const geminiReady=()=>slots.some(e=>e.active<1&&e.cooldownUntil<=now());
export function geminiKeyStatus(){
 return {configured:slots.length,ready:slots.filter(e=>e.active===0&&e.cooldownUntil<=now()&&e.nextCallAt<=now()).length};
}
export function geminiKeyHealth(){
 return {
  configured:slots.length,ready:geminiKeyStatus().ready,
  tested:slots.filter(e=>e.health.checkedAt).length,
  keys:slots.map(e=>({
   slot:e.number,status:e.health.status,httpStatus:e.health.httpStatus,
   checkedAt:e.health.checkedAt,model:e.health.model,latencyMs:e.health.latencyMs,
   cooldownSeconds:Math.max(0,Math.ceil((e.cooldownUntil-now())/1000))
  })),
  totals:{...lastUsage},
  craftModel:process.env.GEMINI_CRAFT_MODEL||'gemini-3.5-flash-lite',
  bingoModel:process.env.GEMINI_BINGO_MODEL||process.env.GEMINI_MODEL||'gemini-3.5-flash'
 };
}
function statusFor(code){
 if(code===429)return 'rate-limited';
 if(code===401)return 'invalid-key';
 if(code===403)return 'restricted';
 if(code===404)return 'model-unavailable';
 if(code===400)return 'bad-request';
 if(code>=500)return 'service-error';
 return 'error';
}
function note(e,httpStatus,model,latencyMs){
 e.health={status:httpStatus===200?'working':statusFor(httpStatus),
  httpStatus,checkedAt:new Date().toISOString(),model,latencyMs};
}
function cooldown(e,error){
 const status=Number(error?.status)||0,delay=Math.max(0,Number(error?.retryMs)||0);
 if(status===429){
  e.limits++;lastUsage.rateLimited++;
  const daily=error.daily===true;
  e.cooldownUntil=now()+Math.max(daily?3600000:delay>0?Math.max(60000,delay):600000,delay);
 }else if(status===401||status===403){
  e.cooldownUntil=now()+12*3600000;e.failures++;
 }else if(status===404||status===400){
  e.cooldownUntil=now()+5*60000;e.failures++;
 }else{
  e.cooldownUntil=now()+15000;e.failures++;
 }
 note(e,status||503,error.model||null,null);
 console.warn('Gemini slot '+e.number+' '+statusFor(status)+' ('+(status||'network')+')');
}
function order(){
 if(!slots.length)return [];
 const start=next++%slots.length;
 return [...slots.slice(start),...slots.slice(0,start)]
  .filter(e=>e.active===0&&e.cooldownUntil<=now()&&e.nextCallAt<=now());
}
async function call(e,{systemPrompt,userPrompt,model,generationConfig,timeoutMs}){
 const t=now();
 const body={
  ...(systemPrompt?{systemInstruction:{parts:[{text:String(systemPrompt)}]}}:{}),
  contents:[{role:'user',parts:[{text:String(userPrompt)}]}],
  generationConfig:{responseMimeType:'application/json',maxOutputTokens:240,...generationConfig}
 };
 let response;
 try{
  response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':e.key},
   signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify(body)
  });
 }catch(cause){
  const err=new Error('Gemini request timeout or network error');err.status=0;err.model=model;throw err;
 }
 if(!response.ok){
  const error=new Error('Gemini HTTP '+response.status);
  error.status=response.status;error.model=model;
  const retry=response.headers?.get?.('retry-after');
  error.retryMs=retry?(Number.isFinite(Number(retry))?Number(retry)*1000:Math.max(0,Date.parse(retry)-now())):0;
  if(response.status===429){
   const text=(await response.text().catch(()=>'')).slice(0,2500);
   error.daily=/per.?day|free_tier_requests|requests_per_day|RPD|quota exceeded.*day/i.test(text);
  }
  throw error;
 }
 const result=await response.json();
 const raw=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
 note(e,200,model,now()-t);
 if(!raw)throw new Error('Gemini returned an empty result');
 let parsed;
 try{parsed=JSON.parse(raw)}catch{throw new Error('Gemini returned malformed JSON')}
 return parsed;
}
export async function generateGeminiJSON({
 systemPrompt,userPrompt,model=process.env.GEMINI_MODEL||'gemini-3.5-flash',
 generationConfig={},timeoutMs=14000,validate,onAttempt,purpose='general'
}){
 if(!slots.length)throw Error('No Gemini keys configured. Add GEMINI_API_KEY_1 through GEMINI_API_KEY_5 in Render.');
 let choices=order();
 if(!choices.length){
  const soon=slots.filter(e=>e.active===0&&e.cooldownUntil<=now()).reduce((m,e)=>Math.min(m,e.nextCallAt),Infinity);
  const delay=soon-now();
  if(delay>0&&delay<=1600)await new Promise(resolve=>setTimeout(resolve,delay));
  choices=order();
 }
 if(!choices.length)throw Error('Gemini keys busy, rate limited or cooling down.');
 let last='No Gemini response';
 for(const e of choices){
  e.active++;
  e.nextCallAt=now()+minimumSpacing;
  try{
   onAttempt?.({number:e.number,total:slots.length});
   let result,usedModel=model;
   try{result=await call(e,{systemPrompt,userPrompt,model:usedModel,generationConfig,timeoutMs})}
   catch(error){
    // A particular project might allow Flash but not Flash-Lite. Fallback only
    // on model 404, never on 429, avoiding another call when quota is exhausted.
    if(error.status===404&&purpose==='craft'&&usedModel==='gemini-3.5-flash-lite'){
     usedModel=process.env.GEMINI_MODEL||'gemini-3.5-flash';
     result=await call(e,{systemPrompt,userPrompt,model:usedModel,generationConfig,timeoutMs});
    }else throw error;
   }
   const value=validate?validate(result):result;
   if(!value){
    last='Gemini returned an unsuitable result';lastUsage.invalid++;
    throw Object.assign(Error(last),{quality:true});
   }
   lastUsage.success++;e.cooldownUntil=0;e.failures=0;e.limits=0;
   return value;
  }catch(error){
   last=scrub(error);lastUsage.failed++;
   if(error.quality||/malformed JSON|empty result/i.test(last)){
    // The key worked. Trying all keys for a bad answer wastes the entire free quota.
    throw Error(last);
   }
   cooldown(e,error);
  }finally{e.active--}
 }
 throw Error('Gemini failed with '+choices.length+' available key(s): '+last);
}
// Run only once per server boot: one tiny real generation per key, not just
// checking if an environment variable exists. No key, project ID or prompt is returned.
let diagnosticPromise;
export function probeGeminiKeys(){
 if(diagnosticPromise)return diagnosticPromise;
 diagnosticPromise=(async()=>{
  const model=process.env.GEMINI_CRAFT_MODEL||'gemini-3.5-flash-lite';
  const results=[];
  for(const e of slots){
   if(e.active)continue;
   e.active++;
   try{
    let value;
    try{
     value=await call(e,{
      model,userPrompt:'Return the JSON object {"ok":true}.',timeoutMs:9000,
      generationConfig:{maxOutputTokens:90,thinkingConfig:{thinkingLevel:'minimal'}}
     });
    }catch(error){
     if(error.status!==404||model!=='gemini-3.5-flash-lite')throw error;
     const backup=process.env.GEMINI_MODEL||'gemini-3.5-flash';
     value=await call(e,{
      model:backup,userPrompt:'Return the JSON object {"ok":true}.',timeoutMs:9000,
      generationConfig:{maxOutputTokens:90,thinkingConfig:{thinkingLevel:'minimal'}}
     });
    }
    e.nextCallAt=now()+minimumSpacing;
    if(value?.ok===true){e.health.status='working';results.push({slot:e.number,status:'working'})}
    else{e.health.status='bad-response';results.push({slot:e.number,status:'bad-response'})}
   }catch(error){
    const code=Number(error.status)||0;
    // Don't make the diagnostic silently repeat over all accounts.
    note(e,code||503,model,null);
    if(code===429||code===401||code===403||code===404)cooldown(e,error);
    results.push({slot:e.number,status:e.health.status});
   }finally{e.active--}
  }
  console.log('Gemini startup checks:',JSON.stringify(results));
  return results;
 })();
 return diagnosticPromise;
}
