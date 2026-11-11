#!/usr/bin/env node
// Local, self-running Infinite Craft recipe explorer using Ollama + Google Gemma.
// No Gemini API, no internet access needed after downloading your Ollama model.
// Saves each useful pair to JSONL immediately; Ctrl+C safely stops the run.
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';

const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(x=>{
 const [key,...rest]=x.slice(2).split('=');return [key,rest.length?rest.join('='):true]
}));
const model=String(args.model||'gemma3:4b');
const root=String(args.endpoint||'http://127.0.0.1:11434').replace(/\/$/,'');
const filename=path.resolve(String(args.file||'local-recipes.jsonl'));
const target=Math.max(1,Math.min(500000,Number(args.max)||300));
const interval=Math.max(0,Math.min(60000,Number(args.delay)||150));
const starters=['Water','Fire','Wind','Earth'];
const key=(a,b)=>[a.trim().toLowerCase(),b.trim().toLowerCase()].sort().join('|');
const validName=value=>typeof value==='string'&&value.length>=2&&value.length<=55&&
 /^[A-Za-z0-9][A-Za-z0-9 '&!. -]*$/.test(value)&&value.split(' ').length<=5;
const validate=(a,b,parsed)=>{
 const word=String(parsed?.word||'').trim().replace(/\s+/g,' ');
 const emoji=String(parsed?.emoji||'✨').trim().slice(0,12)||'✨';
 if(!validName(word)||word.toLowerCase()===a.toLowerCase()||word.toLowerCase()===b.toLowerCase())return null;
 if(/^(thing|object|something|item|combination|result|nothing|undefined)$/i.test(word))return null;
 if(word.toLowerCase()===a.toLowerCase()+' '+b.toLowerCase()||word.toLowerCase()===b.toLowerCase()+' '+a.toLowerCase())return null;
 if(/(?:Tech|Corp|Labs|Solutions|Innovations)$/i.test(word.replace(/\s/g,'')))return null;
 return {a,b,word,emoji};
};
function choose(array){return array[Math.floor(Math.random()*array.length)]}
async function run(){
 const bank=new Map(starters.map(x=>[x.toLowerCase(),x]));
 const seen=new Map(),recent=[];
 if(fs.existsSync(filename)){
  for(const line of fs.readFileSync(filename,'utf8').split(/\r?\n/)){
   if(!line.trim())continue;
   try{
    const p=JSON.parse(line),r=validate(String(p.a||''),String(p.b||''),p);
    if(!r)continue;
    seen.set(key(r.a,r.b),r);bank.set(r.word.toLowerCase(),r.word);
    recent.push(r.word);
   }catch{}
  }
 }
 while(recent.length>500)recent.shift();
 const known=seen.size;
 console.log('\n⚗️  INFINITE RACE LOCAL RECIPE EXPLORER');
 console.log('Model:',model,'| Existing saved recipes:',known,'| Bank:',bank.size);
 console.log('File:',filename,'| Will generate up to',target,'more recipes.\n');
 // The local health check never contacts the public Internet.
 try{
  const response=await fetch(root+'/api/tags',{signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw Error('Ollama returned HTTP '+response.status);
  const installed=(await response.json()).models?.map(x=>x.name)||[];
  if(!installed.some(x=>x===model||x.startsWith(model+':')||model==='gemma3:4b'&&x.startsWith('gemma3:4b')))
   console.warn('⚠️  Model not found in Ollama. Install it with: ollama pull '+model);
 }catch{
  console.error('❌ Could not connect to Ollama at '+root);
  console.error('   Install Ollama from https://ollama.com/download then run: ollama pull '+model);
  process.exitCode=1;return;
 }
 let completed=0,attempts=0,invalid=0,active=true;
 process.on('SIGINT',()=>{active=false;console.log('\nStopping after this request. Saved recipes are already on disk.')});
 const f=fs.createWriteStream(filename,{flags:'a'});
 try{
  while(active&&completed<target){
   const values=[...bank.values()],pairs=values.length*(values.length+1)/2;
   if(seen.size>=pairs){console.log('No more unused pairs in the current word bank.');break}
   let a,b,k;
   for(let t=0;t<200;t++){
    const random=Math.random(),recentPick=recent.length&&random<.57;
    a=recentPick?choose(recent.slice(-Math.min(120,recent.length))):choose(values);
    b=recentPick&&Math.random()<.3?choose(starters):choose(values);
    k=key(a,b);if(!seen.has(k))break;
   }
   if(seen.has(k)){
    // Sampling all pairs is expensive when a bank is small and nearly exhausted.
    let found=false;
    for(const first of values){for(const second of values){if(!seen.has(key(first,second))){a=first;b=second;k=key(a,b);found=true;break}}if(found)break}
    if(!found)break;
   }
   attempts++;
   seen.set(k,null); // Mark every attempted pair; no repeated local-AI calls.
   const prompt=[
    'You are a thoughtful Infinite Craft combination player.',
    'Fuse these two concepts into one REAL established concept, object, person, place, creature, technology or phenomenon.',
    'Both inputs should matter. Try real chemistry, nature or common knowledge first, then clever established associations.',
    'Do not make up brand names, nonsense compounds or simply repeat one ingredient.',
    'Answer ONLY JSON {"word":"Short Real Name","emoji":"🔮"}.',
    'First: '+a, 'Second: '+b
   ].join('\n');
   let crafted=null;
   try{
    const response=await fetch(root+'/api/generate',{
     method:'POST',headers:{'Content-Type':'application/json'},
     signal:AbortSignal.timeout(180000),
     body:JSON.stringify({model,prompt,format:'json',stream:false,keep_alive:'20m',
      options:{temperature:.6,num_predict:110,num_ctx:1536}})
    });
    if(!response.ok)throw Error('Ollama HTTP '+response.status);
    const body=await response.json();
    let answer=String(body.response||'').trim();
    try{crafted=validate(a,b,JSON.parse(answer))}
    catch{
     const match=answer.match(/\{[\s\S]*\}/);
     if(match)crafted=validate(a,b,JSON.parse(match[0]));
    }
   }catch(error){
    console.warn('Model request failed:',String(error.message||error).slice(0,100));
    await pause(2000);
   }
   if(crafted){
    const isNew=!bank.has(crafted.word.toLowerCase());
    if(isNew){bank.set(crafted.word.toLowerCase(),crafted.word);recent.push(crafted.word)}
    seen.set(k,crafted);
    f.write(JSON.stringify({...crafted,localFirstDiscovery:isNew,model,at:new Date().toISOString()})+'\n');
    completed++;
    console.log((isNew?'✨':'✓ ')+' '+a+' + '+b+' → '+crafted.word+
     ' | New this run: '+completed+' / '+target+' | Bank: '+bank.size);
   }else{
    invalid++;
    if(invalid%10===0)console.log('Skipped '+invalid+' invalid or failed model answers.');
   }
   if(interval>0)await pause(interval);
  }
 }finally{
  await new Promise(resolve=>f.end(resolve));
  console.log('\nSaved '+completed+' new recorded combinations to: '+filename);
  console.log('Total saved pairs:',known+completed,'| Discoverable items:',bank.size,'| Model attempts:',attempts);
  console.log('To share them with your website, set DATABASE_URL + RECIPE_IMPORT_TOKEN in Render.');
  console.log('Then run: node tools/upload-local-recipes.mjs --server=https://infinite-race.onrender.com --file='+JSON.stringify(filename));
 }
}
run().catch(error=>{console.error(error);process.exitCode=1});
