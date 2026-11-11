#!/usr/bin/env node
// Upload local Gemma-generated JSONL recipes to your shared Infinite Race vault.
// The only network call is an authenticated POST to the HTTPS server you specify.
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
const args=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(x=>{
 const [key,...rest]=x.slice(2).split('=');return [key,rest.join('=')||true]
}));
const server=String(args.server||'').replace(/\/$/,'');
const file=path.resolve(String(args.file||'local-recipes.jsonl'));
const token=String(process.env.RECIPE_IMPORT_TOKEN||'');
if(!server.startsWith('https://')||!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(server)){
 console.error('Usage: node tools/upload-local-recipes.mjs --server=https://your-game.onrender.com --file=local-recipes.jsonl');
 process.exit(1);
}
if(token.length<20){console.error('Set a private RECIPE_IMPORT_TOKEN of at least 20 characters in this terminal and on Render.');process.exit(1)}
if(!fs.existsSync(file)){console.error('Recipe file not found: '+file);process.exit(1)}
const found=new Map();
for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 if(!line.trim())continue;
 try{
  const obj=JSON.parse(line),a=String(obj.a||'').trim(),b=String(obj.b||'').trim();
  if(!a||!b||!obj.word)continue;
  const pair=[a.toLowerCase(),b.toLowerCase()].sort().join('|');
  if(!found.has(pair))found.set(pair,{a,b,word:obj.word,emoji:obj.emoji||'✨'});
 }catch{}
}
const items=[...found.values()];
if(!items.length){console.log('Nothing to upload.');process.exit(0)}
console.log('Uploading '+items.length+' locally generated recipes to '+server);
let accepted=0,skipped=0,rejected=0;
for(let i=0;i<items.length;i+=50){
 const recipes=items.slice(i,i+50);
 let done=false;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(server+'/api/recipes/import',{
    method:'POST',signal:AbortSignal.timeout(45000),
    headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({recipes})
   });
   const result=await response.json();
   if(!response.ok||!result.ok){
    if([400,401,503].includes(response.status))throw Object.assign(Error(result.error||'HTTP '+response.status),{fatal:true});
    throw Error(result.error||'HTTP '+response.status);
   }
   accepted+=result.accepted||0;skipped+=result.skipped||0;rejected+=result.rejected||0;
   console.log('Uploaded '+Math.min(i+50,items.length)+'/'+items.length+' · New '+accepted+' · Existing '+skipped+' · Rejected '+rejected);
   done=true;break;
  }catch(error){
   if(error.fatal){console.error('Cannot continue:',error.message);process.exit(1)}
   console.warn('Attempt '+attempt+' failed:',error.message);
   if(attempt<3)await pause(1600*attempt);
  }
 }
 if(!done){console.error('Upload stopped. Your local JSONL file is safe; rerun to retry.');process.exit(1)}
}
console.log('Complete: '+accepted+' new shared recipes, '+skipped+' existing, '+rejected+' invalid.');
