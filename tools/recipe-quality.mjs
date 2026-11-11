// Local-only recipe generation quality rules. No remote dictionary or AI APIs.
// Keep the checks conservative: they catch obvious glued inputs, not all hallucinations.
const clean=x=>String(x||'').trim().replace(/\s+/g,' ');
const compact=x=>clean(x).toLocaleLowerCase('en').normalize('NFKD').replace(/[^a-z0-9]/g,'');
const wordlike=x=>/^[A-Za-z0-9][A-Za-z0-9 '&!. -]*$/.test(x)&&x.length>=2&&x.length<=55&&x.split(' ').length<=5;
const unhelpful=/^(?:thing|object|item|something|anything|nothing|unknown|result|combination|concept|element|stuff|creation|invention|new ?thing)$/i;
const genericBrands=/(?:Tech|Corp|Labs|Solutions|Innovations|Systems|Ventures|Enterprises)$/i;

export function looksLikeGluedWords(a,b,result){
 const x=compact(a),y=compact(b),z=compact(result);
 if(!x||!y||!z)return false;
 // Require at least three letters to avoid rejecting legitimate small words
 // like "Ice" because a single-letter ingredient was reused.
 if(x.length>=3&&y.length>=3){
  if(z===x+y||z===y+x)return true;
  // Tiny deletions/overlaps around the seam: steam + tornado -> steamornado.
  for(let cut=1;cut<=3;cut++){
   if(y.length-cut>=3&&z===x+y.slice(cut))return true;
   if(x.length-cut>=3&&z===y+x.slice(cut))return true;
   if(x.length-cut>=3&&z===x.slice(0,-cut)+y)return true;
   if(y.length-cut>=3&&z===y.slice(0,-cut)+x)return true;
  }
  // A long phrase containing the complete names of BOTH ingredients is
  // typically just the inputs rephrased, not an actual discovery.
  if(z.includes(x)&&z.includes(y))return true;
 }
 return false;
}
export function assessRecipe(a,b,parsed){
 const word=clean(parsed?.word).replace(/^["']|["']$/g,'');
 const emoji=clean(parsed?.emoji||'✨').slice(0,12)||'✨';
 const connection=clean(parsed?.connection);
 if(!word||word.toUpperCase()==='NONE'||word.toLowerCase()==='null')
  return {ok:false,reason:'No established connection'};
 if(!wordlike(word)||unhelpful.test(word))return {ok:false,reason:'Not a recognisable short concept'};
 if(compact(word)===compact(a)||compact(word)===compact(b))return {ok:false,reason:'Result repeats one of its ingredients'};
 if(looksLikeGluedWords(a,b,word))return {ok:false,reason:'Made-up mashup of the two ingredient names'};
 if(genericBrands.test(word.replace(/\s/g,'')))return {ok:false,reason:'Invented company or product name'};
 if(parsed?.established!==true)return {ok:false,reason:'Model did not identify an established concept'};
 if(connection.length<25||connection.length>220||!/[\sa-z]/i.test(connection))
  return {ok:false,reason:'Missing a meaningful explanation connecting the ingredients'};
 if(/\b(?:i invented|new word|made.up name|portmanteau|sounds like|blend(?:ed|ing)? the words)\b/i.test(connection))
  return {ok:false,reason:'Explanation admits the answer was invented'};
 return {ok:true,recipe:{a,b,word,emoji,connection}};
}
export function buildCraftPrompt(a,b,rejected=''){
 return [
  'You are a STRICT word-discovery game editor, not a fantasy name generator.',
  'Find ONE existing, widely recognizable word or established short term that logically connects both ingredients.',
  'The answer should be something you could look up in a dictionary or encyclopedia.',
  'Prioritize simple physical effects, real objects, natural phenomena, common inventions, real creatures or familiar culture.',
  'Be creative in the CONNECTION, but NEVER creative in inventing a new word.',
  'ABSOLUTE RULE: No joining, shortening, overlapping, or blending ingredient names. No portmanteaus, made-up compounds, fake scientific terms, or newly invented brands.',
  'Examples of BAD answers: Steam + Tornado = Steamornado; Lake + Tornado = Laketornado; Dust + Smoke = Smokedust; Wind + Tornado = Windornado.',
  'Examples of GOOD reasoning: Fire + Water = Steam (heat turns water to vapor); Moon + Ocean = Tide (gravity moves sea water); Cloud + Computer = Cloud Computing (remote computing metaphor); Lake + Tornado = Waterspout (rotating vortex of air over water).',
  'Quietly consider 3 candidates and reject anything that is coined, repetitive, implausible or only related to one ingredient.',
  'If NO established sensible outcome exists, do NOT invent one. Return {"word":null,"emoji":"","established":false,"connection":""}.',
  'Otherwise return ONLY strict JSON: {"word":"Existing Term","emoji":"one emoji","established":true,"connection":"One short factual sentence explaining how both inputs lead to this established concept."}',
  'Input A: '+a,
  'Input B: '+b,
  ...(rejected?['Your previous answer failed quality checking: '+rejected+'. Choose a DIFFERENT real-world concept or return null.']:[])
 ].join('\n');
}
