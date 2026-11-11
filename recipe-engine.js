import fs from 'node:fs';
import path from 'node:path';
import {generateGeminiJSON,geminiConfigured} from './gemini-pool.js';
import {expandSpecificRecipes} from './recipe-expansion.js';

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

// Offline recipe expansion: coherent thematic transformations, no API requests.
// Generated rules are not claimed as individually hand-authored.
const offlineThemes = [
 ['Fire','🔥','Ash','Smoke','Heat','Flame','Charcoal','Wildfire','Volcano','Lava','Plasma'],
 ['Water','💧','Rain','River','Lake','Ocean','Flood','Mist','Steam','Ice','Waterfall'],
 ['Wind','🌬️','Breeze','Tornado','Hurricane','Storm','Kite','Windmill','Whirlwind','Gust'],
 ['Earth','🌍','Stone','Mountain','Mud','Soil','Clay','Cave','Desert','Island'],
 ['Life','🧬','Animal','Plant','Bacteria','Evolution','Human','Cell','Organism','Ecosystem'],
 ['Space','🌌','Star','Planet','Moon','Galaxy','Universe','Black Hole','Nebula','Meteor'],
 ['Technology','💻','Machine','Robot','Computer','Internet','Laser','Satellite','Artificial Intelligence','Nanotechnology'],
 ['Magic','🪄','Wizard','Spell','Dragon','Unicorn','Phoenix','Enchantment','Potion','Sorcery'],
 ['Music','🎵','Song','Guitar','Piano','Orchestra','Drum','Concert','Melody','Symphony'],
 ['Food','🍽️','Bread','Pizza','Chocolate','Coffee','Tea','Soup','Cake','Cheese'],
 ['Weather','🌦️','Cloud','Rain','Snow','Fog','Hail','Thunder','Lightning','Rainbow'],
 ['City','🏙️','House','Road','Bridge','Factory','Skyscraper','Train','Car','Airport'],
 ['Ocean','🌊','Fish','Whale','Coral','Submarine','Ship','Shark','Beach','Island'],
 ['Forest','🌲','Tree','Leaf','Flower','Mushroom','Wildlife','Jungle','Wood','Seed'],
 ['Time','⌛','Clock','History','Future','Past','Era','Century','Calendar','Time Machine'],
 ['Science','🔬','Atom','Molecule','Chemistry','Physics','Laboratory','Experiment','Energy','Gravity'],
 ['Battle','⚔️','Sword','Shield','Army','Knight','Warrior','Castle','Cannon','War'],
 ['Cyberpunk','🌃','Neon','Hacker','Android','Drone','Cybernetics','Megacity','Neural Interface','Robot'],
 ['Farm','🚜','Wheat','Cow','Sheep','Chicken','Tractor','Crop','Barn','Milk'],
 ['Art','🎨','Painting','Sculpture','Drawing','Museum','Canvas','Portrait','Photography','Animation'],
 ['Medicine','💊','Doctor','Hospital','Vaccine','Antibiotic','Surgery','Cure','Virus','Health'],
 ['Sport','🏅','Football','Basketball','Tennis','Race','Stadium','Athlete','Champion','Trophy'],
 ['Transport','🚗','Car','Train','Airplane','Rocket','Boat','Bicycle','Motorcycle','Bus'],
 ['Nature','🌿','Mountain','River','Forest','Desert','Ocean','Waterfall','Volcano','Canyon'],
 ['Electricity','⚡','Battery','Lightning','Circuit','Solar Panel','Power Plant','Motor','Robot','Light'],
 ['Winter','❄️','Snow','Ice','Blizzard','Snowman','Glacier','Frost','Ski','Igloo'],
 ['Summer','☀️','Beach','Sun','Heat','Vacation','Swimming','Sunglasses','Ice Cream','Surfing'],
 ['Dream','💤','Sleep','Nightmare','Imagination','Fantasy','Memory','Illusion','Lucid Dream','Pillow'],
 ['Mythology','🏛️','God','Titan','Olympus','Zeus','Thor','Odin','Medusa','Minotaur'],
 ['Internet','🌐','Website','Search Engine','Social Media','Meme','Email','Cloud Computing','Server','Data'],
];
for(const theme of offlineThemes){for(const word of theme.slice(2)){if(!items.has(word))items.set(word,theme[1]);}}
// Hand-mapped domain interactions with consistent meaningful outcomes.
const crossOutcomes={
 'Fire|Water':'Steam','Earth|Water':'Plant','Fire|Wind':'Smoke','Earth|Fire':'Lava',
 'Life|Space':'Alien','Life|Technology':'Cyborg','Magic|Technology':'Technomancy',
 'Magic|Battle':'Enchanted Sword','Cyberpunk|City':'Megacity','Technology|City':'Smart City',
 'Science|Space':'Astronomy','Space|Transport':'Spaceship','Space|Battle':'Space War',
 'Food|Science':'Molecular Gastronomy','Food|Fire':'Cooking','Water|Food':'Soup',
 'Ocean|Technology':'Submarine','Forest|Magic':'Enchanted Forest','Nature|Medicine':'Herbal Medicine',
 'Music|Technology':'Electronic Music','Art|Technology':'Digital Art','Art|Science':'Scientific Illustration',
 'Medicine|Technology':'Medical Robot','Weather|Science':'Meteorology','Time|Science':'Time Travel',
 'Mythology|Space':'Constellation','Dream|Technology':'Virtual Reality','Internet|Battle':'Cyberwarfare',
 'Ocean|Battle':'Naval Warfare','Farm|Technology':'Agricultural Robot','Sport|Technology':'Esports',
 'Cyberpunk|Technology':'Cybernetics','Cyberpunk|Battle':'Cyberwarfare','Cyberpunk|Internet':'Hacker',
 'Winter|Weather':'Blizzard','Summer|Ocean':'Beach','Nature|Battle':'Wildfire',
 'Science|Electricity':'Electromagnetism','Technology|Electricity':'Computer',
 'Time|Space':'Spacetime','Magic|Space':'Cosmic Magic','Mythology|Battle':'Ragnarok',
 'Life|Medicine':'Health','Science|Medicine':'Biotechnology','Art|Music':'Musical Theatre',
 'Nature|Science':'Ecology','Dream|Art':'Surrealism','Food|Farm':'Harvest',
 'Summer|Winter':'Seasons','Transport|City':'Traffic','Electricity|Battle':'Laser',
 'Internet|Technology':'Cloud Computing','Farm|Nature':'Agriculture','Ocean|Weather':'Hurricane',
 'Music|Battle':'Battle of the Bands','Mythology|Magic':'Sorcery','Sport|Battle':'Martial Arts'
};

const extraOutcomes=`
Fire|Space=Star;Fire|Science=Combustion;Fire|Technology=Engine;Fire|Magic=Fireball;Fire|Music=Fireworks;Fire|City=Fire Department;Fire|Ocean=Steam;Fire|Forest=Wildfire;Fire|Time=Ash;Fire|Battle=Flamethrower;Fire|Cyberpunk=Neon;Fire|Farm=Barbecue;Fire|Art=Pyrography;Fire|Medicine=Fever;Fire|Sport=Olympic Torch;Fire|Transport=Rocket;Fire|Nature=Volcano;Fire|Electricity=Plasma;Fire|Winter=Hot Chocolate;Fire|Summer=Heatwave;Fire|Dream=Nightmare;Fire|Mythology=Phoenix;Fire|Internet=Firewall;
Water|Space=Ice Comet;Water|Technology=Hydroelectricity;Water|Magic=Potion;Water|Music=Rainstick;Water|City=Canal;Water|Ocean=Sea;Water|Forest=Swamp;Water|Time=Erosion;Water|Battle=Water Cannon;Water|Cyberpunk=Rainy City;Water|Farm=Irrigation;Water|Art=Watercolor;Water|Medicine=Hydration;Water|Sport=Swimming;Water|Transport=Boat;Water|Nature=River;Water|Electricity=Electrolysis;Water|Winter=Ice;Water|Summer=Pool;Water|Dream=Reflection;Water|Mythology=Poseidon;Water|Internet=Stream;
Wind|Space=Solar Wind;Wind|Technology=Wind Turbine;Wind|Magic=Levitation;Wind|Music=Flute;Wind|City=Skyscraper;Wind|Ocean=Sailboat;Wind|Forest=Leaf;Wind|Time=Weathering;Wind|Battle=Arrow;Wind|Cyberpunk=Drone;Wind|Farm=Windmill;Wind|Art=Kinetic Sculpture;Wind|Medicine=Ventilator;Wind|Sport=Kitesurfing;Wind|Transport=Airplane;Wind|Nature=Storm;Wind|Electricity=Wind Power;Wind|Winter=Blizzard;Wind|Summer=Breeze;Wind|Dream=Flight;Wind|Mythology=Aeolus;Wind|Internet=Wireless Network;
Earth|Space=Planet;Earth|Technology=Mining;Earth|Magic=Golem;Earth|Music=Rock Music;Earth|City=Building;Earth|Ocean=Island;Earth|Forest=Soil;Earth|Time=Fossil;Earth|Battle=Fortress;Earth|Cyberpunk=Underground City;Earth|Farm=Field;Earth|Art=Sculpture;Earth|Medicine=Mineral;Earth|Sport=Rock Climbing;Earth|Transport=Tunnel;Earth|Nature=Mountain;Earth|Electricity=Grounding;Earth|Winter=Permafrost;Earth|Summer=Desert;Earth|Dream=Cave;Earth|Mythology=Gaia;Earth|Internet=Data Center;
Life|Fire=Phoenix;Life|Water=Fish;Life|Wind=Bird;Life|Earth=Human;Life|Magic=Unicorn;Life|Music=Songbird;Life|City=Society;Life|Ocean=Coral Reef;Life|Forest=Ecosystem;Life|Time=Evolution;Life|Battle=Survival;Life|Cyberpunk=Cyborg;Life|Farm=Livestock;Life|Art=Portrait;Life|Medicine=Biology;Life|Sport=Athlete;Life|Transport=Migration;Life|Nature=Biodiversity;Life|Electricity=Bioelectricity;Life|Winter=Hibernation;Life|Summer=Growth;Life|Dream=Consciousness;Life|Mythology=Demigod;Life|Internet=Digital Life;
Space|Magic=Cosmic Magic;Space|Music=Space Opera;Space|City=Space Station;Space|Ocean=Ocean Planet;Space|Forest=Alien Jungle;Space|Time=Spacetime;Space|Cyberpunk=Cybernetic Alien;Space|Farm=Space Farm;Space|Art=Constellation;Space|Medicine=Space Medicine;Space|Sport=Zero Gravity;Space|Nature=Cosmos;Space|Electricity=Solar Power;Space|Winter=Frozen Planet;Space|Summer=Solar Flare;Space|Dream=Astral Projection;Space|Internet=Satellite Internet;
Technology|Fire=Engine;Technology|Water=Pump;Technology|Wind=Wind Turbine;Technology|Earth=Drill;Technology|Forest=Paper Mill;Technology|Time=Clock;Technology|Battle=Weapon;Technology|Farm=Tractor;Technology|Medicine=Medical Robot;Technology|Sport=Esports;Technology|Transport=Autonomous Car;Technology|Nature=Biomimicry;Technology|Winter=Snowmobile;Technology|Summer=Air Conditioner;Technology|Dream=Virtual Reality;Technology|Mythology=Mechanical Dragon;
Magic|Music=Enchanted Song;Magic|City=Wizard Tower;Magic|Ocean=Mermaid;Magic|Time=Time Spell;Magic|Farm=Magic Bean;Magic|Art=Illusion;Magic|Medicine=Healing Potion;Magic|Sport=Quidditch;Magic|Transport=Flying Carpet;Magic|Nature=Fairy;Magic|Electricity=Lightning Spell;Magic|Winter=Ice Wizard;Magic|Summer=Sun Magic;Magic|Dream=Lucid Dream;Magic|Internet=Technomancy;
Music|City=Concert Hall;Music|Ocean=Sea Shanty;Music|Forest=Birdsong;Music|Time=Rhythm;Music|Farm=Country Music;Music|Medicine=Music Therapy;Music|Sport=Anthem;Music|Transport=Radio;Music|Nature=Natural Sound;Music|Winter=Christmas Carol;Music|Summer=Summer Hit;Music|Dream=Lullaby;Music|Mythology=Orpheus;Music|Internet=Streaming Music;
Food|Space=Space Food;Food|Technology=Microwave;Food|Magic=Magic Potion;Food|Music=Dinner Theatre;Food|City=Restaurant;Food|Ocean=Seafood;Food|Forest=Mushroom;Food|Time=Fermentation;Food|Battle=Food Fight;Food|Cyberpunk=Synthetic Food;Food|Art=Food Art;Food|Medicine=Nutrition;Food|Sport=Energy Bar;Food|Transport=Food Truck;Food|Nature=Organic Food;Food|Electricity=Electric Oven;Food|Winter=Hot Soup;Food|Summer=Ice Cream;Food|Dream=Dream Cake;Food|Mythology=Ambrosia;Food|Internet=Food Delivery;
Weather|Fire=Heat Lightning;Weather|Space=Space Weather;Weather|Technology=Weather Radar;Weather|Magic=Weather Spell;Weather|Music=Thunderstorm;Weather|City=Urban Heat Island;Weather|Forest=Rainforest;Weather|Time=Climate;Weather|Battle=Stormtrooper;Weather|Cyberpunk=Acid Rain;Weather|Farm=Drought;Weather|Art=Landscape Painting;Weather|Medicine=Seasonal Allergy;Weather|Sport=Snowboarding;Weather|Transport=Flight Delay;Weather|Nature=Climate;Weather|Electricity=Lightning;Weather|Winter=Snowstorm;Weather|Summer=Heatwave;Weather|Dream=Cloud Nine;Weather|Mythology=Thor;Weather|Internet=Weather App;
City|Ocean=Harbor;City|Forest=Park;City|Time=Ancient City;City|Battle=Siege;City|Cyberpunk=Megacity;City|Farm=Market;City|Art=Street Art;City|Medicine=Hospital;City|Sport=Stadium;City|Transport=Metro;City|Nature=Urban Park;City|Electricity=Power Grid;City|Winter=Snowy City;City|Summer=Beach Town;City|Dream=Utopia;City|Mythology=Atlantis;City|Internet=Smart City;
Ocean|Forest=Mangrove;Ocean|Time=Tide;Ocean|Cyberpunk=Underwater City;Ocean|Farm=Fish Farm;Ocean|Art=Seascape;Ocean|Medicine=Marine Biology;Ocean|Sport=Surfing;Ocean|Transport=Ship;Ocean|Nature=Marine Ecosystem;Ocean|Electricity=Tidal Power;Ocean|Winter=Sea Ice;Ocean|Summer=Beach;Ocean|Dream=Mermaid;Ocean|Mythology=Poseidon;Ocean|Internet=Undersea Cable;
Forest|Time=Ancient Forest;Forest|Battle=Camouflage;Forest|Cyberpunk=Biohacker;Forest|Farm=Orchard;Forest|Art=Woodcarving;Forest|Medicine=Herbal Medicine;Forest|Sport=Hiking;Forest|Transport=Logging Truck;Forest|Nature=Woodland;Forest|Electricity=Biomass;Forest|Winter=Evergreen;Forest|Summer=Campfire;Forest|Dream=Enchanted Forest;Forest|Mythology=Dryad;Forest|Internet=Network Tree;
Time|Battle=History;Time|Cyberpunk=Future;Time|Farm=Harvest Season;Time|Art=Antique;Time|Medicine=Aging;Time|Sport=World Record;Time|Transport=Time Machine;Time|Nature=Evolution;Time|Electricity=Clock;Time|Winter=Solstice;Time|Summer=Summer Solstice;Time|Dream=Memory;Time|Mythology=Chronos;Time|Internet=Timeline;
Science|Magic=Alchemy;Science|City=Research Institute;Science|Ocean=Oceanography;Science|Forest=Ecology;Science|Battle=Ballistics;Science|Cyberpunk=Cybernetics;Science|Farm=Genetics;Science|Art=Photography;Science|Sport=Sports Science;Science|Transport=Engineering;Science|Nature=Biology;Science|Winter=Cryogenics;Science|Summer=Solar Energy;Science|Dream=Neuroscience;Science|Mythology=Mythology;Science|Internet=Data Science;
Battle|Farm=Pitchfork;Battle|Art=War Painting;Battle|Medicine=Field Hospital;Battle|Sport=Martial Arts;Battle|Transport=Tank;Battle|Nature=Survival;Battle|Electricity=Railgun;Battle|Winter=Winter War;Battle|Summer=Summer Campaign;Battle|Dream=Nightmare;Battle|Mythology=Valhalla;
Cyberpunk|Farm=Vertical Farm;Cyberpunk|Art=Neon Art;Cyberpunk|Medicine=Cybernetic Implant;Cyberpunk|Sport=Cyber Arena;Cyberpunk|Transport=Flying Car;Cyberpunk|Nature=Biopunk;Cyberpunk|Electricity=Neon;Cyberpunk|Winter=Neon Snow;Cyberpunk|Summer=Neon Sunset;Cyberpunk|Dream=Simulated Reality;Cyberpunk|Mythology=Cyber Dragon;
Farm|Art=Landscape Painting;Farm|Medicine=Veterinary Medicine;Farm|Sport=Horse Racing;Farm|Transport=Tractor;Farm|Nature=Agriculture;Farm|Electricity=Electric Fence;Farm|Winter=Greenhouse;Farm|Summer=Harvest;Farm|Dream=Pastoral Dream;Farm|Mythology=Demeter;
Art|Medicine=Art Therapy;Art|Sport=Figure Skating;Art|Transport=Graffiti Train;Art|Nature=Landscape Painting;Art|Electricity=Light Art;Art|Winter=Ice Sculpture;Art|Summer=Sand Sculpture;Art|Dream=Surrealism;Art|Mythology=Greek Statue;Art|Internet=Digital Art;
Medicine|Sport=Physical Therapy;Medicine|Transport=Ambulance;Medicine|Nature=Natural Remedy;Medicine|Electricity=Defibrillator;Medicine|Winter=Flu;Medicine|Summer=Sunburn;Medicine|Dream=Sleep Medicine;Medicine|Mythology=Asclepius;Medicine|Internet=Telemedicine;
Sport|Transport=Race Car;Sport|Nature=Trail Running;Sport|Electricity=Electric Kart;Sport|Winter=Skiing;Sport|Summer=Surfing;Sport|Dream=Olympic Dream;Sport|Mythology=Olympics;Sport|Internet=Esports;
Transport|Nature=Eco Tourism;Transport|Electricity=Electric Car;Transport|Winter=Snowmobile;Transport|Summer=Road Trip;Transport|Dream=Flying Car;Transport|Mythology=Chariot;Transport|Internet=GPS;
Nature|Electricity=Renewable Energy;Nature|Winter=Glacier;Nature|Summer=Wildflower;Nature|Dream=Paradise;Nature|Mythology=Mother Nature;Nature|Internet=Nature Documentary;
Electricity|Winter=Electric Heater;Electricity|Summer=Air Conditioner;Electricity|Dream=Electric Dreams;Electricity|Mythology=Zeus;Electricity|Internet=Wi-Fi;
Winter|Summer=Seasons;Winter|Dream=Snow Globe;Winter|Mythology=Yeti;Winter|Internet=Online Shopping;
Summer|Dream=Summer Vacation;Summer|Mythology=Apollo;Summer|Internet=Travel Blog;
Dream|Mythology=Prophecy;Dream|Internet=Virtual Reality;
Mythology|Internet=Internet Legend
`;
for(const entry of extraOutcomes.split(';')){const parts=entry.trim().split('=');if(parts.length===2)crossOutcomes[parts[0].trim()]=parts[1].trim()}
const themeResult=(a,b)=>crossOutcomes[a+'|'+b]||crossOutcomes[b+'|'+a]||null;
for(let i=0;i<offlineThemes.length;i++)for(let j=i+1;j<offlineThemes.length;j++){
 const a=offlineThemes[i],b=offlineThemes[j],result=themeResult(a[0],b[0]);
 if(!result)continue;
 if(!items.has(result))items.set(result,a[1]);
 for(const left of a.slice(2))for(const right of b.slice(2)){
  const k=pairKey(left,right);if(!recipes.has(k))recipes.set(k,{word:result,emoji:items.get(result)});
 }
}
// A reachable, deep progression for offline crafting.
const bridgeRecipes=[['Sun','Sun','Star'],['Star','Earth','Planet'],['Star','Planet','Space'],['Space','Fire','Rocket'],['Planet','Stone','Gravity'],['Glass','Sand','Hourglass'],['Hourglass','Sun','Clock'],['Clock','Clock','Time'],['Sun','Electricity','Solar Panel'],['Electricity','Machine','Computer'],['Robot','Computer','Artificial Intelligence']];for(const [a,b,result] of bridgeRecipes){const k=pairKey(a,b);recipes.set(k,{word:result,emoji:items.get(result)||'✨'});if(!items.has(result))items.set(result,'✨')}
const longChain=[
 ['Robot','Internet','Artificial Intelligence'],['Artificial Intelligence','Computer','Neural Network'],
 ['Neural Network','Electricity','Deep Learning'],['Deep Learning','Robot','Autonomous Robot'],
 ['Autonomous Robot','Factory','Automation'],['Automation','Internet','Internet of Things'],
 ['Internet of Things','City','Smart City'],['Smart City','Electricity','Smart Grid'],
 ['Smart Grid','Battery','Energy Storage'],['Energy Storage','Solar Panel','Renewable Energy'],
 ['Renewable Energy','Planet','Sustainable Planet'],['Sustainable Planet','Spaceship','Space Colony'],
 ['Space Colony','Planet','Terraforming'],['Terraforming','Robot','Terraforming Robot'],
 ['Terraforming Robot','Galaxy','Interstellar Civilization'],
 ['Interstellar Civilization','Time Machine','Galactic Empire'],
 ['Galactic Empire','Black Hole','Cosmic Empire'],
 ['Cosmic Empire','Universe','Multiverse'],
 ['Multiverse','Time','Eternal Multiverse']
];
for(const [a,b,result] of longChain){const k=pairKey(a,b);if(!recipes.has(k))recipes.set(k,{word:result,emoji:items.get(result)||'🌌'});if(!items.has(result))items.set(result,'🌌')}
// Override broad generic theme outcomes with specific, deterministic discoveries.
const previousRecipeCount=recipes.size;
const specificKeys=new Set();
let specificOverrides=0,specificNew=0;
const specificAttempted=expandSpecificRecipes((a,b,word,emoji)=>{
 const k=pairKey(a,b),had=recipes.has(k);
 if(!specificKeys.has(k)){
  specificKeys.add(k);
  if(had)specificOverrides++;else specificNew++;
 }
 const value={word,emoji:emoji||items.get(word)||'✨'};
 recipes.set(k,value);items.set(word,value.emoji);
});
const offlineRecipeCount=recipes.size;
const builtinKeys=new Set(recipes.keys());
const dynamicKeys=new Set();
export const recipeStats=()=>({offlineRecipes:offlineRecipeCount,previousRecipes:previousRecipeCount,specificRecipes:specificKeys.size,newSpecificRecipes:specificNew,improvedExistingRecipes:specificOverrides,generatedPatterns:specificAttempted,cachedRecipes:dynamicKeys.size,totalRecipes:recipes.size,depthExample:'Eternal Multiverse',depthAdditionalSteps:longChain.length});
const storePath=process.env.RECIPE_CACHE_PATH||path.resolve('recipes-cache.json');
try{
 const saved=JSON.parse(fs.readFileSync(storePath,'utf8'));
 if(saved.cacheVersion===2||saved.cacheVersion===3){
  const list=saved.dynamicRecipes||saved.recipes||{};
  for(const [key,value] of Object.entries(list)){
   if(builtinKeys.has(key))continue;
   if(value&&typeof value.word==='string'&&typeof value.emoji==='string'&&/^[A-Za-z0-9][A-Za-z0-9 '&!. -]*$/.test(value.word)&&value.word.length<=55){
    recipes.set(key,value);dynamicKeys.add(key);items.set(value.word,value.emoji);
   }
  }
 }
}catch{}
let cacheTimer=null,persisting=false,dirty=false;
async function flushCache(){
 if(persisting){dirty=true;return}
 persisting=true;dirty=false;
 try{
  const dynamic={};
  for(const key of dynamicKeys)if(recipes.has(key))dynamic[key]=recipes.get(key);
  const temporary=storePath+'.tmp';
  await fs.promises.writeFile(temporary,JSON.stringify({cacheVersion:3,dynamicRecipes:dynamic}));
  await fs.promises.rename(temporary,storePath);
 }catch(e){console.warn('Could not persist dynamic recipes:',e.message)}
 finally{persisting=false;if(dirty)persist()}
}
function persist(){
 dirty=true;
 if(cacheTimer)return;
 cacheTimer=setTimeout(()=>{cacheTimer=null;void flushCache()},8000);
 cacheTimer.unref?.();
}
export function knownCombination(a,b){return recipes.get(pairKey(a,b))||null}
export function registerLocalCombination(a,b,word,emoji){
 const k=pairKey(a,b);
 if(recipes.has(k))return recipes.get(k);
 word=String(word||'').trim().replace(/\s+/g,' ');
 emoji=String(emoji||'✨').trim().slice(0,16)||'✨';
 if(badResult(word,a,b)||word.split(' ').length>5||!/^[A-Za-z0-9][A-Za-z0-9 '&\-!.]*$/.test(word))throw Error('Local AI gave an invalid result. Try again.');
 const result={word,emoji};recipes.set(k,result);dynamicKeys.add(k);items.set(word,emoji);persist();return result;
}
export function emojiOf(word){return items.get(word)||'✨'}
export function allEmojis(){return Object.fromEntries(items)}
const pending=new Map();
const badResult=(word,a,b)=>{
 const w=word.trim().toLowerCase(),x=a.toLowerCase(),y=b.toLowerCase();
 return !w||w===`${x} ${y}`||w===`${y} ${x}`||w===`${x}${y}`||w===`${y}${x}`||w===`${x}-${y}`||w===`${y}-${x}`||w.length>55||/\n|[|{}]/.test(word);
};
const systemPrompt=`You run an Infinite Craft discovery game. Combine two concepts into ONE real, recognizable thing, noun phrase, famous place, established character or scientific phenomenon (normally 1–3 words). BOTH inputs must contribute. Prefer actual chemistry or natural interactions, then a known invention or relationship, then clever pop-culture links or defensible wordplay. Be surprising but explainable. Never invent companies, products or nonsense compounds, never simply join the two words, and never output generic filler like "Technology" or "Object". Choose one fitting Unicode emoji. Return ONLY JSON {"word":"...","emoji":"..."}. Same inputs regardless of order must give the same result.`;
async function askAI(a,b,context=''){
 return generateGeminiJSON({
  model:process.env.GEMINI_CRAFT_MODEL||'gemini-3.5-flash-lite',
  systemPrompt,
  userPrompt:JSON.stringify({a,b}),
  generationConfig:{temperature:.55,maxOutputTokens:210,thinkingConfig:{thinkingLevel:'minimal'}},
  timeoutMs:11500,
  purpose:'craft',
  validate(parsed){
   const word=String(parsed?.word||'').trim().replace(/\s+/g,' ').replace(/^["'\x60]+|["'\x60.]+$/g,'');
   const emoji=String(parsed?.emoji||'').trim();
   const bland=/^(thing|object|item|combination|result|technology|unknown|something)$/i.test(word);
   const brand=/(?:Tech|Corp|Labs|Innovations|Solutions|Soft|Industries|Systems|Ventures)$/i.test(word.replace(/\s+/g,''));
   if(badResult(word,a,b)||word.split(' ').length>5||bland||brand||!/^[A-Za-z0-9][A-Za-z0-9 '&!. -]*$/.test(word))return null;
   return {word,emoji:emoji&&emoji.length<=16?emoji:'✨'};
  }
 });
}
export async function combine(a,b,context=''){
 const k=pairKey(a,b);
 if(recipes.has(k))return recipes.get(k);
 if(!geminiConfigured())throw new Error('Gemini is not configured. Add GEMINI_API_KEY_1 through GEMINI_API_KEY_5 in Render.');
 if(pending.has(k))return pending.get(k);
 const task=(async()=>{
  const result=await askAI(a,b,context);
  recipes.set(k,result);dynamicKeys.add(k);items.set(result.word,result.emoji);persist();return result;
 })();
 pending.set(k,task);
 try{return await task}finally{pending.delete(k)}
}
// Breadth-first reachability analysis of the offline graph from the four starters.
export function offlinePathTo(target){
 const depth=new Map(starters.map(x=>[x.toLowerCase(),0]));
 const how=new Map();
 for(let round=0;round<90;round++){
  let changed=false;
  for(const [pair,output] of recipes){
   const [a,b]=pair.split('|'),key=output.word.toLowerCase();
   if(!depth.has(a)||!depth.has(b))continue;
   const next=Math.max(depth.get(a),depth.get(b))+1;
   if(!depth.has(key)||next<depth.get(key)){
    depth.set(key,next);how.set(key,{pair,word:output.word});changed=true;
   }
  }
  if(!changed)break;
 }
 const deepest=[...depth].sort((a,b)=>b[1]-a[1])[0];if(target==='__deepest__')return {word:deepest[0],depth:deepest[1],reachableCount:depth.size};
 const key=target.toLowerCase();if(!depth.has(key))return {reachable:false};
 const chain=[],done=new Set();function visit(x){if(done.has(x))return;done.add(x);const edge=how.get(x);if(!edge)return;const [a,b]=edge.pair.split('|');visit(a);visit(b);chain.push(`${a} + ${b} → ${edge.word}`)}visit(key);
 return {reachable:true,depth:depth.get(key),totalDistinctCrafts:chain.length,chain};
}
