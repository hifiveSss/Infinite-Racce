// Shared Gemini key pool for server-side crafting and bingo.
// Supports up to five independently configured credentials. Keys never reach clients.
// Quotas are enforced by Google per Cloud project, NOT per API key.
const entries=Array.from({length:5},(_,i)=>({
 number:i+1,
 key:(process.env['GEMINI_API_KEY_'+(i+1)]||(i===0?process.env.GEMINI_API_KEY:'')||'').trim(),
 active:0,cooldownUntil:0,limits:0
})).filter(x=>x.key);
const slots=entries.filter((entry,index,all)=>all.findIndex(other=>other.key===entry.key)===index);
let next=0;
const safeError=e=>String(e?.message||e||'Unknown error').replace(/AIza[0-9A-Za-z_\-]+/g,'[hidden key]').slice(0,180);
export const geminiConfigured=()=>slots.length>0;
export const geminiKeyCount=()=>slots.length;
export const geminiReady=()=>slots.some(x=>Date.now()>=x.cooldownUntil&&x.active<2);
export function geminiKeyStatus(){return {configured:slots.length,ready:slots.filter(x=>x.cooldownUntil<=Date.now()).length}}
function cooldown(slot,error){
 const status=Number(error?.status)||0;
 const text=safeError(error);
 const limited=status===429||/quota|rate.?limit|resource.exhausted/i.test(text);
 if(limited){
  slot.limits++;
  const retry=Math.max(0,Number(error.retryMs)||0);
  const duration=Math.max(Math.min(3600000,120000*2**Math.min(4,slot.limits-1)),Math.min(retry,3600000));
  slot.cooldownUntil=Date.now()+duration;
 }else{
  slot.limits=0;
  slot.cooldownUntil=Date.now()+([400,401,403,404].includes(status)?15*60000:12000);
 }
 console.warn('Gemini provider '+slot.number+' temporarily unavailable: '+text);
}
function order(){
 if(!slots.length)return [];
 const pivot=next++%slots.length;
 return [...slots.slice(pivot),...slots.slice(0,pivot)].filter(x=>x.active<2&&Date.now()>=x.cooldownUntil);
}
export async function generateGeminiJSON({
 systemPrompt,userPrompt,model=process.env.GEMINI_MODEL||'gemini-3.5-flash',
 generationConfig={},timeoutMs=26000,validate,onAttempt
}){
 if(!slots.length)throw new Error('No Gemini keys configured. Add GEMINI_API_KEY_1 through GEMINI_API_KEY_5 in Render.');
 const available=order();
 if(!available.length)throw new Error('All configured Gemini keys are busy or cooling down.');
 let last='No Gemini response';
 for(const slot of available){
  slot.active++;
  try{
   onAttempt?.({number:slot.number,total:slots.length});
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
    method:'POST',
    signal:AbortSignal.timeout(timeoutMs),
    headers:{'Content-Type':'application/json','x-goog-api-key':slot.key},
    body:JSON.stringify({
     ...(systemPrompt?{systemInstruction:{parts:[{text:String(systemPrompt)}]}}:{}),
     contents:[{role:'user',parts:[{text:String(userPrompt)}]}],
     generationConfig:{responseMimeType:'application/json',temperature:0.45,maxOutputTokens:900,...generationConfig}
    })
   });
   if(!response.ok){
    const err=new Error('Gemini HTTP '+response.status);
    err.status=response.status;
    const retry=response.headers.get('retry-after');
    err.retryMs=retry?(Number.isFinite(Number(retry))?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now())):0;
    throw err;
   }
   const data=await response.json();
   const raw=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
   if(!raw)throw new Error('Gemini returned no text');
   let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('Gemini returned invalid JSON')}
   let value=parsed;
   if(validate){
    value=validate(parsed);
    if(!value)throw new Error('Gemini result did not pass validation');
   }
   slot.limits=0;slot.cooldownUntil=0;
   return value;
  }catch(error){
   last=safeError(error);
   cooldown(slot,error);
  }finally{slot.active--}
 }
 throw new Error('Gemini could not complete this request across '+available.length+' available key(s): '+last);
}
