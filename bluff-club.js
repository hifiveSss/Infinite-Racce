// A self-contained room-code party game. No external AI or database required.
export function attachBluffClub(io){
 const nsp=io.of('/bluff');
 const rooms=new Map();
 const clients=new Map();
 const deck=[{"question":"What royal-sounding name did William Herschel originally propose for Uranus?","answer":"Georgium Sidus","decoys":["Regium Astrum","Caelestis Rex","Britannia Major"],"source":"https://science.nasa.gov/uranus/facts/","fact":"Herschel tried to honour King George III, but the name did not stick."},{"question":"Which Uranian moon has canyons up to twelve times as deep as the Grand Canyon?","answer":"Miranda","decoys":["Umbriel","Ariel","Juliet"],"source":"https://science.nasa.gov/uranus/moons/facts/","fact":"NASA describes dramatic fault canyons on Miranda."},{"question":"Which major moon of Uranus has a mysterious bright ring on its surface?","answer":"Umbriel","decoys":["Miranda","Titania","Oberon"],"source":"https://science.nasa.gov/uranus/moons/facts/","fact":"Umbriel is the darkest major Uranian moon and has a mysterious bright ring."},{"question":"Which Uranian moon has the brightest and possibly youngest surface?","answer":"Ariel","decoys":["Oberon","Portia","Umbriel"],"source":"https://science.nasa.gov/uranus/moons/facts/","fact":"Ariel appears unusually bright and relatively young."},{"question":"Which writer's characters, alongside Shakespeare's, inspired names for Uranus's moons?","answer":"Alexander Pope","decoys":["John Milton","Geoffrey Chaucer","William Blake"],"source":"https://science.nasa.gov/uranus/moons/facts/","fact":"A few Uranian moons draw names from Alexander Pope's poetry."},{"question":"Which 11-year-old suggested Pluto's eventual name in 1930?","answer":"Venetia Burney","decoys":["Dorothy Vaughan","Annie Jump Cannon","Elizabeth Williams"],"source":"https://science.nasa.gov/dwarf-planets/pluto/facts/","fact":"Venetia Burney suggested the name Pluto as a schoolgirl."},{"question":"Which Pluto moon shares its name with the three-headed dog of Greek myth?","answer":"Kerberos","decoys":["Hydra","Nix","Styx"],"source":"https://science.nasa.gov/dwarf-planets/pluto/facts/","fact":"Kerberos is named for the guardian dog of the underworld."},{"question":"Which Pluto moon is named after the mythological river dividing living and dead?","answer":"Styx","decoys":["Nix","Hydra","Charon"],"source":"https://science.nasa.gov/dwarf-planets/pluto/facts/","fact":"The Styx is an underworld river in Greek mythology."},{"question":"What is the name of the moon orbiting the dwarf planet Eris?","answer":"Dysnomia","decoys":["Namaka","Hi'iaka","Kerberos"],"source":"https://science.nasa.gov/solar-system/moons/facts/","fact":"Dysnomia is Eris's known moon."},{"question":"Which dwarf planet was discovered to possess a ring despite its stretched-out shape?","answer":"Haumea","decoys":["Makemake","Ceres","Eris"],"source":"https://science.nasa.gov/image-article/apod-2017-october-17-haumea-of-the-outer-solar-system/","fact":"Haumea has a distinctive elongated shape and a ring."},{"question":"What was the first asteroid moon photographed by a spacecraft eventually called?","answer":"Dactyl","decoys":["Mimas","Nereid","Metis"],"source":"https://science.nasa.gov/solar-system/moons/facts/","fact":"Galileo imaged a tiny moon accompanying asteroid Ida."},{"question":"What nickname was given to Makemake's provisionally named moon?","answer":"MK 2","decoys":["Little Mac","MM One","Dwarflet"],"source":"https://science.nasa.gov/solar-system/moons/facts/","fact":"The provisional moon S/2015 (136472) 1 is nicknamed MK 2."},{"question":"Which oddly shaped Saturn moon is commonly likened to a piece of ravioli?","answer":"Pan","decoys":["Janus","Mimas","Dione"],"source":"https://science.nasa.gov/solar-system/10-things-unsolved-mysteries-of-saturns-moons/","fact":"Pan looks like ravioli because of its equatorial ridge."},{"question":"Which Saturn moon maintains a gap in its rings called the Encke Gap?","answer":"Pan","decoys":["Atlas","Prometheus","Pandora"],"source":"https://science.nasa.gov/saturn/moons/pan/","fact":"Pan's gravity clears the Encke Gap."},{"question":"What name did scientists give an unusual possible moon-forming object in Saturn's rings?","answer":"Peggy","decoys":["Molly","Betsy","Ellie"],"source":"https://science.nasa.gov/solar-system/10-things-unsolved-mysteries-of-saturns-moons/","fact":"Cassini scientists nicknamed a possible moon-forming ring object Peggy."},{"question":"Which Saturn moon is sometimes compared to a meatball?","answer":"Janus","decoys":["Tethys","Enceladus","Iapetus"],"source":"https://science.nasa.gov/solar-system/10-things-unsolved-mysteries-of-saturns-moons/","fact":"NASA describes Janus's appearance as meatball-like."},{"question":"Which Saturn moon ejects tall water plumes through south-pole fractures?","answer":"Enceladus","decoys":["Dione","Titan","Hyperion"],"source":"https://science.nasa.gov/solar-system/10-things-unsolved-mysteries-of-saturns-moons/","fact":"Its water plumes emerge from cracks over a subsurface ocean."},{"question":"Which Neptune moon orbits backwards compared with Neptune's rotation?","answer":"Triton","decoys":["Nereid","Proteus","Larissa"],"source":"https://science.nasa.gov/solar-system/moons/facts/","fact":"Triton has a retrograde orbit."},{"question":"Which planet has a quasi-satellite officially named Zoozve?","answer":"Venus","decoys":["Mars","Mercury","Neptune"],"source":"https://science.nasa.gov/venus/venus-facts/","fact":"Zoozve circles the Sun but stays near Venus."},{"question":"What bizarre name did an artist accidentally invent while misreading '2002 VE'?","answer":"Zoozve","decoys":["Zoonie","Vezzor","Zovve"],"source":"https://science.nasa.gov/venus/venus-facts/","fact":"Zoozve came from a handwritten misreading on a solar-system poster."},{"question":"What is the technical name for a sea urchin's complex chewing apparatus?","answer":"Aristotle's lantern","decoys":["Poseidon's pincers","Plato's mill","Huxley's crown"],"source":"https://www.nhm.ac.uk/discover/sea-urchins-strange-and-spiny-wonders-of-the-ocean.html","fact":"Sea urchins have five self-sharpening teeth in their complex jaws."},{"question":"What are the sharp rear-end defensive structures in some sea cucumbers nicknamed?","answer":"Anal teeth","decoys":["Tail thorns","Rear spines","Calcium plugs"],"source":"https://www.nhm.ac.uk/discover/what-is-a-sea-cucumber.html","fact":"Some sea cucumbers have calcified tube feet around the anus."},{"question":"What is the scientific name of the deep-sea 'headless chicken monster'?","answer":"Enypniastes eximia","decoys":["Psychropotes longicauda","Glaucus atlanticus","Jorunna parva"],"source":"https://www.nhm.ac.uk/discover/what-is-a-sea-cucumber.html","fact":"This swimming sea cucumber has web-like fins."},{"question":"What deep-sea sea cucumber is nicknamed the 'gummy squirrel'?","answer":"Psychropotes longicauda","decoys":["Enypniastes eximia","Actinopyga caerulea","Synapta maculata"],"source":"https://www.nhm.ac.uk/discover/what-is-a-sea-cucumber.html","fact":"Its appearance resembles a squirrel-shaped gummy sweet."},{"question":"Which sea-cucumber genus is known for having five defensive 'anal teeth'?","answer":"Actinopyga","decoys":["Holothuria","Cucumaria","Enypniastes"],"source":"https://www.nhm.ac.uk/discover/what-is-a-sea-cucumber.html","fact":"Actinopyga species can use hard tube feet as a barrier."},{"question":"What are the stinging organelles stolen by some sea slugs called?","answer":"Nematocysts","decoys":["Chromatophores","Statocysts","Cnidopores"],"source":"https://www.nhm.ac.uk/discover/nudibranchs-psychedelic-thieves-of-the-sea.html","fact":"Nudibranchs can reuse the stinging cells of their prey."},{"question":"What are the tentacle-like structures that can store stolen stings on some sea slugs called?","answer":"Cerata","decoys":["Rhinophores","Parapodia","Setae"],"source":"https://www.nhm.ac.uk/discover/nudibranchs-psychedelic-thieves-of-the-sea.html","fact":"Aeolid nudibranchs store stolen stings in their cerata."},{"question":"What does the word 'nudibranch' literally refer to?","answer":"Naked gill","decoys":["Hidden shell","Blue tail","Sea dancer"],"source":"https://www.nhm.ac.uk/discover/nudibranchs-psychedelic-thieves-of-the-sea.html","fact":"The exposed breathing apparatus gives nudibranchs their name."},{"question":"What is the scientific name of the blue dragon sea slug?","answer":"Glaucus atlanticus","decoys":["Jorunna parva","Elysia chlorotica","Nembrotha kubaryana"],"source":"https://www.nhm.ac.uk/discover/nudibranchs-psychedelic-thieves-of-the-sea.html","fact":"Glaucus atlanticus floats at the surface on its back."},{"question":"What is the scientific name of the tiny 'sea bunny' slug?","answer":"Jorunna parva","decoys":["Glaucus marginatus","Facelina bostoniensis","Acanthodoris pilosa"],"source":"https://www.nhm.ac.uk/discover/nudibranchs-psychedelic-thieves-of-the-sea.html","fact":"Sea bunnies are a type of dorid nudibranch."},{"question":"What substance makes up almost all of a hagfish's expanded slime?","answer":"Seawater","decoys":["Collagen","Keratin","Alginic acid"],"source":"https://www.nhm.ac.uk/discover/how-much-slime-can-a-hagfish-make.html","fact":"The slime is mostly water, with tiny amounts of mucins and threads."},{"question":"What are the mucus-forming proteins in hagfish slime called?","answer":"Mucins","decoys":["Keratoids","Fibrinogens","Myosins"],"source":"https://www.nhm.ac.uk/discover/how-much-slime-can-a-hagfish-make.html","fact":"Mucins help hagfish slime trap seawater."},{"question":"What shape do hagfish tie their bodies into to remove excess slime?","answer":"Knot","decoys":["Spiral disc","Figure eight","Triangle"],"source":"https://www.nhm.ac.uk/discover/how-much-slime-can-a-hagfish-make.html","fact":"They slide a knot down their bodies to scrape the slime away."},{"question":"What are the whisker-like food-finding appendages around a hagfish's mouth called?","answer":"Barbels","decoys":["Cerata","Palps","Radulae"],"source":"https://www.nhm.ac.uk/discover/how-much-slime-can-a-hagfish-make.html","fact":"Hagfish use fleshy barbels and smell to locate food."},{"question":"What is a frogfish's modified fishing-rod-like dorsal spine called?","answer":"Illicium","decoys":["Esca","Rhinophore","Cerata"],"source":"https://www.nhm.ac.uk/discover/the-fish-that-walk.html","fact":"The illicium is a modified fin spine used to lure prey."},{"question":"What is the fake 'bait' at the tip of a frogfish's hunting rod called?","answer":"Esca","decoys":["Illicium","Rostrum","Barbel"],"source":"https://www.nhm.ac.uk/discover/the-fish-that-walk.html","fact":"The esca can resemble a worm, shrimp or small fish."},{"question":"Which predatory fish can open its mouth to capture prey in about six milliseconds?","answer":"Frogfish","decoys":["Needlefish","Archerfish","Mudskipper"],"source":"https://www.nhm.ac.uk/discover/the-fish-that-walk.html","fact":"The frogfish can strike at remarkable speed."},{"question":"Which reef creature has been observed queuing in size order to swap used shells?","answer":"Hermit crab","decoys":["Fiddler crab","Peacock mantis shrimp","Sea urchin"],"source":"https://www.nhm.ac.uk/discover/seven-sneaky-survival-strategies-reef-animals.html","fact":"Hermit crabs can form vacancy chains to exchange shells."},{"question":"Which deep-forest mammal has zebra-like markings and reddish fur?","answer":"Okapi","decoys":["Saola","Bongo","Sitatunga"],"source":"https://www.nhm.ac.uk/discover/elusive-creatures-of-the-natural-world.html","fact":"Okapis have striking markings that help camouflage them."},{"question":"Which 1967 multi-game console prototype was nicknamed the 'Brown Box'?","answer":"Ralph Baer's system","decoys":["Atari Cosmos","Pong Cabinet","Microvision"],"source":"https://americanhistory.si.edu/explore/topics/invention-and-innovation","fact":"Ralph Baer's Brown Box led to the Magnavox Odyssey."},{"question":"What everyday food container was Dorr E. Felt's first adding-machine model built from?","answer":"Macaroni box","decoys":["Tea tin","Biscuit tin","Butter tub"],"source":"https://americanhistory.si.edu/explore/exhibitions/inventing-in-america/innovation-prototypes-I","fact":"Dorr Felt used an empty macaroni shipping box to prototype the Comptometer."},{"question":"Which early mechanical calculator originated as a prototype made from a macaroni box?","answer":"Comptometer","decoys":["Arithmometer","Curta","Pascaline"],"source":"https://americanhistory.si.edu/explore/exhibitions/inventing-in-america/innovation-prototypes-I","fact":"The Comptometer was an early commercially successful key-operated adding machine."},{"question":"What was an 1857 typewriter with piano-like keys nicknamed?","answer":"Literary Piano","decoys":["Writing Harp","Mechanical Organ","Printing Pianola"],"source":"https://americanhistory.si.edu/collections/object/nmah_850543","fact":"Samuel W. Francis designed a typewriter with an ivory piano-style keyboard."},{"question":"What device invented around 1795 used steam to rotate meat above a fire?","answer":"Steam Jack","decoys":["Turbine Spit","Cooking Engine","Rotary Hearth"],"source":"https://www.si.edu/object/nmah_849114","fact":"A Bailey steam jack used steam pressure to turn the roasting spit."},{"question":"Which inventor's camera-shutter patent model was designed to photograph fast-moving animals?","answer":"Eadweard Muybridge","decoys":["Louis Daguerre","George Eastman","John Herschel"],"source":"https://americanhistory.si.edu/explore/exhibitions/inventing-in-america/innovation-prototypes-I","fact":"Muybridge developed an apparatus for photographing objects in motion."},{"question":"Which inventor patented an automated vegetable-sorting machine in 1879?","answer":"John Heinz","decoys":["Joseph Campbell","Clarence Birdseye","Elijah Smith"],"source":"https://americanhistory.si.edu/explore/exhibitions/inventing-in-america/innovation-prototypes-I","fact":"John Heinz automated sorting vegetables by size."},{"question":"Which inventor is remembered for inventing the zigzag overstitch sewing machine?","answer":"Helen Blanchard","decoys":["Margaret Knight","Hedy Lamarr","Elizabeth Magie"],"source":"https://americanhistory.si.edu/explore/exhibitions/inventing-in-america/innovation-prototypes-I","fact":"Helen Blanchard patented a number of sewing-machine innovations."},{"question":"What was Lee De Forest's amplifying electron tube called?","answer":"Audion","decoys":["Radiotron","Thermion","Magnetron"],"source":"https://americanhistory.si.edu/explore/exhibitions/inventing-in-america/innovation-prototypes-I","fact":"The Audion helped enable electronic amplification."},{"question":"Which invention was patented by Dr. Samuel Ward Francis in 1857?","answer":"Writing machine","decoys":["Electric telegraph","Rotary calculator","Talking clock"],"source":"https://americanhistory.si.edu/collections/object/nmah_850543","fact":"Francis built a typewriting device with piano-like keys."},{"question":"What did Isaac Adams's early patent model improve in 1830?","answer":"Printing press","decoys":["Sewing machine","Steam engine","Loom"],"source":"https://americanhistory.si.edu/explore/exhibitions/inventing-in-america/innovation-prototypes-I","fact":"Adams's design inspired later power presses."},{"question":"Which 1881 portable typewriter was invented by Emery M. Hamilton?","answer":"Hamilton typewriter","decoys":["Blickensderfer","Oliver typewriter","Underwood No. 1"],"source":"https://americanhistory.si.edu/ne/collections/object/nmah_849907","fact":"Hamilton's machine was an early attempt at portable typewriters."}];
 const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const clean=(value,max=90)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
 const shuffle=list=>{const output=list.slice();for(let i=output.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[output[i],output[j]]=[output[j],output[i]]}return output};
 const code=()=>{let result;do{result=Math.random().toString(36).slice(2,8).toUpperCase()}while(rooms.has(result));return result};
 const playerInfo=(room,p)=>({id:p.id,name:p.name,score:p.score,ready:room.stage==='writing'?room.bluffs.has(p.id):room.stage==='voting'?room.votes.has(p.id):false});
 function status(room){
  return {
   code:room.code,host:room.host,stage:room.stage,round:room.index+1,totalRounds:room.total,
   prompt:room.stage==='lobby'||room.stage==='finished'?null:room.question?.question||null,
   endsAt:room.endsAt,players:[...room.players.values()].map(p=>playerInfo(room,p)).sort((a,b)=>b.score-a.score),
   submissions:room.bluffs.size,votes:room.votes.size,
   choices:room.stage==='voting'?room.choices.map(o=>({id:o.id,text:o.text})):[],
   reveal:room.stage==='reveal'?room.reveal:null,
   winners:room.stage==='finished'?room.winners:[],
   deckSize:deck.length
  };
 }
 function send(room){nsp.to(room.code).emit('state',status(room))}
 function stopTimer(room){if(room.timer){clearTimeout(room.timer);room.timer=null}}
 function schedule(room,ms,fn){stopTimer(room);room.endsAt=Date.now()+ms;room.timer=setTimeout(()=>{room.timer=null;fn()},ms)}
 function choose(room){
  const left=deck.map((_,i)=>i).filter(i=>!room.used.has(i));
  if(!left.length)room.used.clear();
  const pool=left.length?left:deck.map((_,i)=>i);
  const id=pool[Math.floor(Math.random()*pool.length)];
  room.used.add(id);return deck[id];
 }
 function startWriting(room){
  room.stage='writing';room.question=choose(room);room.bluffs=new Map();room.votes=new Map();
  room.choices=[];room.reveal=null;
  schedule(room,65000,()=>startVoting(room));
  send(room);
 }
 function startVoting(room){
  if(room.stage!=='writing')return;
  room.stage='voting';
  const answers=new Map();
  const truth=normalize(room.question.answer);
  for(const [id,text] of room.bluffs){
   const key=normalize(text);
   if(!key||key===truth)continue;
   if(!answers.has(key))answers.set(key,{text,authors:[]});
   answers.get(key).authors.push(id);
  }
  const options=[{id:'truth',text:room.question.answer,authors:[],truth:true}];
  for(const item of answers.values())options.push({id:'answer'+options.length,text:item.text,authors:item.authors,truth:false});
  const decoys=shuffle(room.question.decoys).filter(x=>!answers.has(normalize(x))&&normalize(x)!==truth);
  let added=0;
  for(const wrong of decoys){
   if(options.length>=Math.max(4,room.players.size+1)||added>=3)break;
   options.push({id:'decoy'+added,text:wrong,authors:[],truth:false});added++;
  }
  room.choices=shuffle(options);
  schedule(room,38000,()=>finishVoting(room));
  send(room);
 }
 function finishVoting(room){
  if(room.stage!=='voting')return;
  room.stage='reveal';
  const gains=new Map([...room.players.keys()].map(id=>[id,0]));
  const breakdown=room.choices.map(option=>{
   const voters=[...room.votes].filter(([,id])=>id===option.id).map(([id])=>id);
   if(option.truth){for(const id of voters)gains.set(id,(gains.get(id)||0)+1000)}
   else if(option.authors.length){
    for(const id of voters)for(const author of option.authors){
     if(author===id)continue;
     gains.set(author,(gains.get(author)||0)+Math.floor(500/option.authors.length));
    }
   }
   return {id:option.id,text:option.text,truth:option.truth,authors:option.authors.map(id=>room.players.get(id)?.name||'Player'),voters:voters.map(id=>room.players.get(id)?.name||'Player'),votes:voters.length};
  });
  for(const [id,gain] of gains){const p=room.players.get(id);if(p)p.score+=gain}
  room.reveal={answer:room.question.answer,explanation:room.question.fact||'The real answer was '+room.question.answer+'.',source:room.question.source||null,choices:breakdown,gains:[...gains].map(([id,points])=>({id,name:room.players.get(id)?.name||'Player',points}))};
  schedule(room,13500,()=>next(room));send(room);
 }
 function finishGame(room){
  room.stage='finished';room.endsAt=null;room.question=null;
  const top=Math.max(...[...room.players.values()].map(p=>p.score),0);
  room.winners=[...room.players.values()].filter(p=>p.score===top).map(p=>p.id);
  send(room);
 }
 function next(room){
  if(room.stage!=='reveal')return;
  room.index++;
  if(room.index>=room.total)finishGame(room);
  else startWriting(room);
 }
 function leave(socket){
  const current=clients.get(socket.id);
  clients.delete(socket.id);
  if(!current)return;
  socket.leave(current);
  const room=rooms.get(current);
  if(!room)return;
  room.players.delete(socket.id);room.bluffs.delete(socket.id);room.votes.delete(socket.id);
  if(!room.players.size){stopTimer(room);rooms.delete(room.code);return}
  if(room.host===socket.id)room.host=room.players.keys().next().value;
  if(room.stage==='writing'&&room.bluffs.size===room.players.size)startVoting(room);
  else if(room.stage==='voting'&&room.votes.size===room.players.size)finishVoting(room);
  else send(room);
 }
 const error=(ack,message)=>ack?.({ok:false,error:message});
 nsp.on('connection',socket=>{
  socket.on('create',(raw,ack)=>{
   leave(socket);
   const name=clean(raw?.name,22)||'Player';
   const room={code:code(),host:socket.id,players:new Map(),stage:'lobby',index:0,total:6,used:new Set(),timer:null,endsAt:null,question:null,bluffs:new Map(),votes:new Map(),choices:[],reveal:null,winners:[]};
   room.players.set(socket.id,{id:socket.id,name,score:0});rooms.set(room.code,room);
   clients.set(socket.id,room.code);socket.join(room.code);
   ack?.({ok:true,code:room.code});send(room);
  });
  socket.on('join',(raw,ack)=>{
   const key=clean(raw?.code,6).toUpperCase(),room=rooms.get(key);
   if(!room)return error(ack,'Room not found. Double-check the code.');
   if(room.stage!=='lobby'&&room.stage!=='finished')return error(ack,'That game has already started. Join the next one!');
   if(room.players.size>=12)return error(ack,'This room is full (12 players maximum).');
   leave(socket);
   const name=clean(raw?.name,22)||'Player';
   room.players.set(socket.id,{id:socket.id,name,score:0});clients.set(socket.id,key);socket.join(key);
   ack?.({ok:true,code:key});send(room);
  });
  socket.on('leave',(_,ack)=>{leave(socket);socket.emit('state',null);ack?.({ok:true})});
  socket.on('start',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.host!==socket.id)return error(ack,'Only the host can start.');
   if(!['lobby','finished'].includes(room.stage))return error(ack,'Game already running.');
   if(room.players.size<2)return error(ack,'You need at least two players.');
   room.total=Math.max(3,Math.min(10,Number(data?.rounds)||6));
   room.index=0;room.winners=[];room.used=new Set();
   for(const p of room.players.values())p.score=0;
   startWriting(room);ack?.({ok:true});
  });
  socket.on('bluff',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.stage!=='writing'||!room.players.has(socket.id))return error(ack,'The writing round is closed.');
   const answer=clean(data?.text,72);
   if(answer.length<2)return error(ack,'Write a convincing answer (at least 2 characters).');
   if(room.bluffs.has(socket.id))return error(ack,'You already submitted your bluff.');
   room.bluffs.set(socket.id,answer);ack?.({ok:true});
   if(room.bluffs.size===room.players.size)startVoting(room);else send(room);
  });
  socket.on('vote',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.stage!=='voting'||!room.players.has(socket.id))return error(ack,'Voting is closed.');
   if(room.votes.has(socket.id))return error(ack,'You already voted.');
   const choice=room.choices.find(c=>c.id===data?.id);
   if(!choice)return error(ack,'That answer is not an option.');
   if(choice.authors.includes(socket.id))return error(ack,'You cannot vote for your own bluff!');
   room.votes.set(socket.id,choice.id);ack?.({ok:true});
   if(room.votes.size===room.players.size)finishVoting(room);else send(room);
  });
  socket.on('skip',(data,ack)=>{
   const room=rooms.get(clients.get(socket.id));
   if(!room||room.host!==socket.id)return error(ack,'Only the host can advance rounds.');
   if(room.stage==='writing')startVoting(room);
   else if(room.stage==='voting')finishVoting(room);
   else if(room.stage==='reveal'){stopTimer(room);next(room)}
   else return error(ack,'Nothing to advance right now.');
   ack?.({ok:true});
  });
  socket.on('disconnect',()=>leave(socket));
 });
}
