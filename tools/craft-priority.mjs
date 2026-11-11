// Calculate the minimum number of combination operations needed to make each
// word from Water, Fire, Wind and Earth, then explore unexplored pairs in order
// of total crafting cost. No AI calls or network access in this module.
const normal=x=>String(x||'').trim().toLowerCase();
const ROOTS=['water','fire','wind','earth'];
function gcd(a,b){while(b){const t=a%b;a=b;b=t}return a}
class MinHeap{
 constructor(){this.a=[]}
 push(item){const a=this.a;let i=a.length;a.push(item);while(i>0){const p=(i-1)>>1;if(a[p][0]<=item[0])break;a[i]=a[p];i=p}a[i]=item}
 pop(){const a=this.a,top=a[0],last=a.pop();if(a.length){let i=0;while(true){const l=2*i+1;if(l>=a.length)break;let j=l;if(l+1<a.length&&a[l+1][0]<a[l][0])j=l+1;if(a[j][0]>=last[0])break;a[i]=a[j];i=j}a[i]=last}return top}
 get length(){return this.a.length}
}
function triangularPair(index,n){
 // Row zero contains n pairs; row one contains n-1; etc. 0 <= i <= j < n.
 let low=0,high=n-1;
 while(low<high){
  const mid=Math.ceil((low+high)/2);
  const prefix=mid*n-mid*(mid-1)/2;
  if(prefix<=index)low=mid;else high=mid-1;
 }
 const i=low,prefix=i*n-i*(i-1)/2;
 return [i,i+index-prefix];
}
function permutation(count){
 let cursor=0,offset=Math.floor(Math.random()*count),step=count===1?1:1+Math.floor(Math.random()*(count-1));
 if(count>1){while(gcd(step,count)!==1)step=step+1>=count?1:step+1}
 return {next(){if(cursor>=count)return null;return (offset+step*cursor++)%count}};
}
export class CraftPriority{
 constructor(recipes=[]){
  this.edges=[];this.dependents=new Map();this.costs=new Map();this.byCost=new Map();
  this.heap=new MinHeap();this.currentScore=0;this.preparedScore=-1;this.queues=[];this.queueIndex=0;
  for(const row of recipes)this.addRecipe(row,false);
  for(const root of ROOTS)this.setCost(root,0);
  this.drain();
 }
 setCost(word,value){
  word=normal(word);
  if(!word||!Number.isSafeInteger(value)||value<0)return false;
  const old=this.costs.get(word);
  if(old!==undefined&&old<=value)return false;
  if(old!==undefined)this.byCost.get(old)?.delete(word);
  this.costs.set(word,value);
  if(!this.byCost.has(value))this.byCost.set(value,new Set());
  this.byCost.get(value).add(word);
  this.heap.push([value,word]);return true;
 }
 addRecipe(row,process=true){
  if(!Array.isArray(row)||row.length<3)return false;
  const [a,b,out]=row.map(normal);
  if(!a||!b||!out||out===a||out===b)return false;
  const index=this.edges.length;this.edges.push([a,b,out]);
  for(const input of new Set([a,b])){
   if(!this.dependents.has(input))this.dependents.set(input,[]);
   this.dependents.get(input).push(index);
  }
  this.relax(index);
  if(process)this.drain();
  return true;
 }
 relax(index){
  const [a,b,out]=this.edges[index],costA=this.costs.get(a),costB=this.costs.get(b);
  if(costA===undefined||costB===undefined)return;
  this.setCost(out,costA+costB+1);
 }
 drain(){
  while(this.heap.length){
   const [cost,word]=this.heap.pop();
   if(this.costs.get(word)!==cost)continue;
   for(const index of this.dependents.get(word)||[])this.relax(index);
  }
 }
 get reachable(){return this.costs.size}
 costOf(word){return this.costs.get(normal(word))}
 get lowestPairCost(){return this.currentScore}
 makeTier(score){
  const queues=[];
  for(let ca=0;ca<=Math.floor(score/2);ca++){
   const cb=score-ca,aa=[...(this.byCost.get(ca)||[])],bb=[...(this.byCost.get(cb)||[])];
   if(!aa.length||!bb.length)continue;
   // A permutation visits each pair once without allocating potentially
   // billions of combinations to memory.
   const n=aa.length,m=bb.length,same=ca===cb;
   const total=same?n*(n+1)/2:n*m;
   const perm=permutation(total);
   queues.push({aa,bb,n,m,same,perm,cost:score});
  }
  // Shuffle cost-equivalent group orders, rotating after every candidate.
  for(let i=queues.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queues[i],queues[j]]=[queues[j],queues[i]]}
  this.queues=queues;this.queueIndex=0;
 }
 nextPair(known,attempted,excludedWords=null){
  // known/attempted use lowercased, unordered keys.
  if(this.reachable<2)return null;
  const max=Math.max(...this.byCost.keys())*2;
  while(this.currentScore<=max){
   if(this.preparedScore!==this.currentScore){this.makeTier(this.currentScore);this.preparedScore=this.currentScore}
   if(!this.queues.length){this.currentScore++;continue}
   if(this.queueIndex>=this.queues.length)this.queueIndex=0;
   const q=this.queues[this.queueIndex];
   const at=q.perm.next();
   if(at===null){
    this.queues.splice(this.queueIndex,1);
    continue;
   }
   this.queueIndex=(this.queueIndex+1)%this.queues.length;
   const [i,j]=q.same?triangularPair(at,q.n):[Math.floor(at/q.m),at%q.m];
   const a=q.aa[i],b=q.bb[j],pair=[a,b].sort().join('|');
   if(this.costs.get(a)+this.costs.get(b)!==this.currentScore)continue; // costs improved mid-session
   if(excludedWords&&(excludedWords.has(a)||excludedWords.has(b)))continue; // avoid old AI mashup ingredients
   if(known.has(pair)||attempted.has(pair))continue;
   return {a,b,pair,costA:this.costs.get(a),costB:this.costs.get(b),totalCrafts:this.currentScore};
  }
  return null;
 }
}
