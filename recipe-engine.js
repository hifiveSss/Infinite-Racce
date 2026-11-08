import fs from 'node:fs';
import path from 'node:path';

// Stable, order-independent combinations. Emoji are standard Unicode emoji.
export const starters = ['Water', 'Fire', 'Wind', 'Earth'];
export const emojiDefaults = {
  Water:'💧',Fire:'🔥',Wind:'🌬️',Earth:'🌍',Steam:'💨',Plant:'🌱',Dust:'🌫️',Smoke:'💨',Lava:'🌋',
  Wave:'🌊',Mud:'🟤',Stone:'🪨',Sand:'🏖️',Cloud:'☁️',Rain:'🌧️',Lightning:'⚡',Sun:'☀️',
  Mountain:'⛰️',Lake:'🏞️',Ocean:'🌊',River:'🏞️',Forest:'🌲',Tree:'🌳',Grass:'🌿',
  Volcano:'🌋',Planet:'🪐',Swamp:'🐊',Dandelion:'🌼',Flower:'🌸',Rainbow:'🌈',Glass:'🥃',
  Metal:'🔩',Steel:'🔩',Sword:'⚔️',Machine:'⚙️',Engine:'⚙️',Car:'🚗',Train:'🚆',
  Airplane:'✈️',Jet:'🛩️',Rocket:'🚀',Spaceship:'🚀',Robot:'🤖',Computer:'💻',
  Electricity:'⚡',Energy:'⚡',Internet:'🌐',Phone:'📱',Book:'📖',Paper:'📄',
  Wood:'🪵',Charcoal:'🪨',Ash:'🌫️',Fireplace:'🔥',House:'🏠',City:'🏙️',
  Human:'🧑',Life:'🧬',Animal:'🐾',Fish:'🐟',Bird:'🐦',Dragon:'🐉',Dinosaur:'🦖',
  Snow:'❄️',Ice:'🧊',Blizzard:'🌨️',Storm:'⛈️',Tornado:'🌪️',Hurricane:'🌀',
  Desert:'🏜️',Beach:'🏖️',Island:'🏝️',Earthquake:'🌎',Moon:'🌙',Star:'⭐',
  Galaxy:'🌌',Space:'🌌','Black Hole':'🕳️',Universe:'🌌',Time:'⏳',
  Pizza:'🍕',Bread:'🍞',Food:'🍽️',Chocolate:'🍫',Coffee:'☕',Tea:'🍵',
  Music:'🎵',Song:'🎶',Guitar:'🎸','Video Game':'🎮',Game:'🎮',Castle:'🏰',
  Boat:'⛵',Ship:'🚢',Pirate:'🏴‍☠️',Mermaid:'🧜‍♀️',Unicorn:'🦄',
  Dinosaur:'🦖',Fossil:'🦴',Oil:'🛢️',Factory:'🏭',Pollution:'🏭',
  Garden:'🌷',Farm:'🚜',Wheat:'🌾',Seed:'🌰',Fruit:'🍎',Apple:'🍎',
  Pottery:'🏺',Clay:'🟤',Brick:'🧱',Wall:'🧱',Road:'🛣️',Bridge:'🌉',
  Sandstorm:'🌪️',Fog:'🌫️',Mist:'🌫️','Steam Engine':'🚂',Windmill:'🌬️',
  Electricity:'⚡','Solar Panel':'☀️',Battery:'🔋',Light:'💡',Lamp:'🪔',
  Life:'🧬',Bacteria:'🦠',Evolution:'🧬',Fish:'🐟',Coral:'🪸',Reef:'🪸'
};
const starterRecipes = [
 ['Water','Fire','Steam'],['Water','Earth','Plant'],['Water','Wind','Wave'],['Earth','Wind','Dust'],
 ['Fire','Wind','Smoke'],['Earth','Fire','Lava'],['Water','Water','Lake'],['Fire','Fire','Sun'],
 ['Wind','Wind','Tornado'],['Earth','Earth','Mountain'],['Plant','Water','Tree'],
 ['Plant','Fire','Ash'],['Plant','Earth','Grass'],['Plant','Wind','Dandelion'],
 ['Steam','Wind','Cloud'],['Cloud','Water','Rain'],['Cloud','Fire','Lightning'],
 ['Rain','Sun','Rainbow'],['Rain','Earth','Mud'],['Dust','Water','Mud'],
 ['Lava','Water','Stone'],['Stone','Wind','Sand'],['Sand','Fire','Glass'],
 ['Stone','Fire','Metal'],['Tree','Fire','Charcoal'],['Tree','Water','Forest'],
 ['Tree','Tree','Forest'],['Tree','Wind','Leaf'],['Leaf','Water','Tea'],
 ['Stone','Stone','Boulder'],['Lake','Water','Ocean'],['Mountain','Water','River'],
 ['Mountain','Fire','Volcano'],['Mountain','Wind','Snow'],['Snow','Water','Ice'],
 ['Snow','Wind','Blizzard'],['Ocean','Wind','Storm'],['Ocean','Earth','Island'],
 ['Ocean','Sun','Beach'],['Ocean','Fire','Steam'],['Ocean','Life','Fish'],
 ['Ocean','Plant','Seaweed'],['Ocean','Stone','Coral'],['Ocean','Fish','Shark'],
 ['Fire','Grass','Wildfire'],['Forest','Fire','Wildfire'],['Forest','Water','Swamp'],
 ['Grass','Water','Swamp'],['Grass','Earth','Field'],['Field','Plant','Farm'],
 ['Farm','Water','Crop'],['Farm','Plant','Wheat'],['Wheat','Fire','Bread'],
 ['Bread','Fire','Toast'],['Bread','Cheese','Pizza'],['Cheese','Fire','Pizza'],
 ['Mud','Fire','Brick'],['Mud','Earth','Clay'],['Clay','Fire','Pottery'],
 ['Brick','Brick','Wall'],['Brick','Wood','House'],['House','House','Village'],
 ['Village','Village','City'],['City','City','Metropolis'],['City','Water','Canal'],
 ['Metal','Stone','Steel'],['Metal','Fire','Sword'],['Metal','Wind','Airplane'],
 ['Metal','Water','Rust'],['Metal','Electricity','Robot'],['Metal','Machine','Robot'],
 ['Metal','Stone','Ore'],['Machine','Machine','Factory'],['Metal','Metal','Machine'],
 ['Machine','Water','Pump'],['Machine','Fire','Engine'],['Engine','Wind','Jet'],
 ['Engine','Metal','Car'],['Engine','Water','Steam Engine'],['Car','Car','Traffic'],
 ['Car','Electricity','Electric Car'],['Engine','Steel','Train'],
 ['Steel','Water','Ship'],['Wood','Water','Boat'],['Boat','Wind','Sailboat'],
 ['Boat','Ocean','Ship'],['Ship','Pirate','Pirate Ship'],['Ship','Wind','Sailboat'],
 ['Sun','Plant','Photosynthesis'],['Sun','Water','Rainbow'],['Sun','Earth','Day'],
 ['Sun','Moon','Eclipse'],['Moon','Water','Tide'],['Moon','Wind','Space'],
 ['Star','Star','Galaxy'],['Galaxy','Galaxy','Universe'],['Galaxy','Space','Universe'],
 ['Star','Gravity','Black Hole'],['Space','Rocket','Spaceship'],
 ['Fire','Electricity','Plasma'],['Lightning','Metal','Electricity'],
 ['Lightning','Water','Electricity'],['Lightning','Tree','Fire'],
 ['Electricity','Computer','Internet'],['Electricity','Machine','Robot'],
 ['Electricity','Light','Lamp'],['Energy','Sun','Solar Panel'],
 ['Solar Panel','Electricity','Battery'],['Wind','Machine','Windmill'],
 ['Earth','Life','Human'],['Water','Life','Fish'],['Tree','Life','Animal'],
 ['Life','Life','Evolution'],['Plant','Life','Animal'],['Animal','Air','Bird'],
 ['Animal','Water','Fish'],['Animal','Time','Fossil'],['Fossil','Life','Dinosaur'],
 ['Dinosaur','Fire','Dragon'],['Dragon','Fire','Dragon'],
 ['Paper','Paper','Book'],['Tree','Paper','Book'],['Wood','Machine','Paper'],
 ['Computer','Game','Video Game'],['Music','Computer','Electronic Music'],
 ['Music','Wind','Flute'],['Music','Wood','Guitar'],['Music','Music','Song'],
 ['Song','Human','Singer'],['Time','Machine','Time Machine'],
 ['Unicorn','Rainbow','Magic'],['Magic','Book','Spell'],
 ['Fire','Water','Steam'],['Lake','Wind','Wave'],['Sand','Water','Beach'],
 ['Desert','Wind','Sandstorm'],['Rain','Wind','Storm'],['Storm','Ocean','Hurricane'],
 ['Fire','Sand','Glass'],['Glass','Sand','Hourglass'],['Hourglass','Time','Clock'],
 ['Wood','Fire','Ash'],['Ash','Water','Lye'],['Smoke','Water','Fog'],
 ['Fog','Wind','Mist'],['Mud','Plant','Swamp'],['Tree','Earth','Forest'],
 ['Forest','Animal','Wildlife'],['Island','Volcano','Hawaii'],
 ['Plant','Sun','Flower'],['Flower','Flower','Garden'],['Flower','Wind','Pollen'],
 ['Water','Ice','Iceberg'],['Ice','Wind','Snow'],['Ice','Fire','Water'],
 ['Fire','Food','Cooking'],['Cooking','Food','Meal'],['Water','Coffee','Coffee'],
 ['Water','Tea','Tea'],['Water','Wheat','Dough'],['Dough','Fire','Bread'],
 ['Fire','Chocolate','Hot Chocolate'],['Star','Moon','Night'],
 ['Night','Sun','Day'],['Rainbow','Cloud','Sky'],['Cloud','Cloud','Storm'],
 ['Earth','Space','Planet'],['Planet','Planet','Solar System'],
 ['Water','Electricity','Hydrogen'],['Hydrogen','Oxygen','Water']
];
export const pairKey=(a,b)=>[a.trim().toLocaleLowerCase('en'),b.trim().toLocaleLowerCase('en')].sort().join('|');
const items = new Map(Object.entries(emojiDefaults));
const recipes = new Map();
for (const [a,b,result] of starterRecipes) recipes.set(pairKey(a,b),{word:result,emoji:items.get(result)||'✨'});
const storePath=process.env.RECIPE_CACHE_PATH||path.resolve('recipes-cache.json');
try {
 const saved=JSON.parse(fs.readFileSync(storePath,'utf8'));
 for(const [k,v] of Object.entries(saved.recipes||saved)){
  if(typeof v==='string'){
   // Legacy concatenated results are intentionally ignored; they can spoil future AI responses.
   if(items.has(v))recipes.set(k.toLowerCase(),{word:v,emoji:items.get(v)});
  }else if(v&&typeof v.word==='string'&&typeof v.emoji==='string')recipes.set(k,{word:v.word,emoji:v.emoji});
 }
 for(const [k,v] of Object.entries(saved.emojis||{}))if(typeof v==='string')items.set(k,v);
}catch{}
function persist(){
 try{fs.writeFileSync(storePath,JSON.stringify({recipes:Object.fromEntries(recipes),emojis:Object.fromEntries(items)}))}
 catch(e){console.warn('Could not persist recipes:',e.message)}
}
export function emojiOf(word){return items.get(word)||'✨'}
export function allEmojis(){return Object.fromEntries(items)}
const pending=new Map();
const badResult=(word,a,b)=>{
 const w=word.trim().toLowerCase(),x=a.toLowerCase(),y=b.toLowerCase();
 return !w||w===`${x} ${y}`||w===`${y} ${x}`||w===`${x}${y}`||w===`${y}${x}`||w===`${x}-${y}`||w===`${y}-${x}`||w.length>55||/\n|[|{}]/.test(word);
};
const systemPrompt=`You are the creative, intelligent crafting engine for an Infinite Craft-style discovery game.
Inputs are two discovered concepts. Produce ONE satisfying, real, familiar thing, concept, person, place or phenomenon, represented by a short standalone noun phrase and ONE apt Unicode emoji.
Prioritize in this order:
1. Actual physical/chemical/natural result (Water + Fire = Steam).
2. Known thing or process created using both ingredients (Metal + Engine = Car).
3. Shared defining property, real-world relationship, mythology, pop culture, metaphor or clever wordplay (unusual pairings).
4. Surprise is good ONLY when the connection is defensible. Be inventive and specific, not generic.
Never just concatenate the input names, invent a random compound, output a vague filler (Thing, Object, Combination), or explain the answer. The result should feel like an actual discovery.
Order is irrelevant. Same pair must give same result. You may reuse an ingredient only when the transformation naturally produces it.
Choose an emoji as close as possible to the common Infinite Craft visual style: ordinary, expressive Unicode emoji, rather than text symbols. When no exact emoji exists, use the nearest recognizable emoji.
Reply with only a JSON object: {"word":"...","emoji":"..."}. Word normally 1-3 words, max 5. Emoji max 2 grapheme clusters.`;
async function askAI(a,b){
 const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';
 const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
 let response;
 try{
  response=await fetch(endpoint,{
   method:'POST',signal:AbortSignal.timeout(18000),
   headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
   body:JSON.stringify({
    systemInstruction:{parts:[{text:systemPrompt}]},
    contents:[{role:'user',parts:[{text:JSON.stringify({ingredient1:a,ingredient2:b})}]}],
    generationConfig:{temperature:0.65,responseMimeType:'application/json',maxOutputTokens:512}
   })
  });
 }catch(error){throw new Error('Free AI connection failed. Try again shortly.');}
 if(!response.ok){
  const body=await response.text().catch(()=>'');console.error('Gemini API error',response.status,body.slice(0,500));
  if(response.status===404)throw new Error('Gemini model not available. Set GEMINI_MODEL to a supported free-tier model in Render.');
  if(response.status===429)throw new Error('Free AI daily/minute limit reached. Try again later.');
  if(response.status===403||response.status===401)throw new Error('Gemini key is invalid or its free tier is unavailable for this project.');
  throw new Error('Free AI service unavailable right now.');
 }
 const data=await response.json();
 const raw=data.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('')||'';
 let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('AI returned an invalid recipe. Try again.');}
 const word=String(parsed.word||'').trim().replace(/\s+/g,' ').replace(/^["'`]+|["'`.]+$/g,'');
 const emoji=String(parsed.emoji||'').trim();
 if(badResult(word,a,b)||word.split(' ').length>5)throw new Error('AI could not find a sensible result. Try again.');
 return {word,emoji:emoji&&emoji.length<=16?emoji:'✨'};
}
export async function combine(a,b){
 const k=pairKey(a,b);
 if(recipes.has(k))return recipes.get(k);
 if(!process.env.GEMINI_API_KEY)throw new Error('Free AI is not configured. Add a GEMINI_API_KEY from Google AI Studio in your Render Environment.');
 if(pending.has(k))return pending.get(k);
 const task=(async()=>{
  let result;
  for(let attempt=0;attempt<2;attempt++){
   try{result=await askAI(a,b);break}catch(e){if(attempt===1||!/invalid recipe|sensible result/.test(e.message))throw e;}
  }
  recipes.set(k,result);items.set(result.word,result.emoji);persist();return result;
 })();
 pending.set(k,task);
 try{return await task}finally{pending.delete(k)}
}
