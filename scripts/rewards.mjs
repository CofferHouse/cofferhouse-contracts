import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ethers} from 'ethers';
const coder=ethers.AbiCoder.defaultAbiCoder();
export function rewardLeaf(d,account,amount){
 return ethers.keccak256(ethers.keccak256(coder.encode(
  ['uint256','address','address','uint256','address','address','uint256'],
  [d.chainId,d.distributor,d.membership,d.epoch,d.token,account,amount])));
}
const pair=(a,b)=>ethers.keccak256(ethers.concat([a,b].sort()));
export const LEVEL_WEIGHTS = Object.freeze(['0','2','4','7','10','16']);
export function makeManifest(d,snapshot,weights,budget){
 if(weights.map(String).join(',')!==LEVEL_WEIGHTS.join(','))throw Error('Weights differ from contract policy');
 if(weights.length!==6)throw Error('Supply all six approved level weights');
 weights=weights.map(BigInt);budget=BigInt(budget);
 if(weights.some(x=>x<0n)||budget<=0n)throw Error('Invalid weights/budget');
 if(!Number.isSafeInteger(snapshot.blockNumber)||!ethers.isHexString(snapshot.blockHash,32)
  ||String(snapshot.chainId)!==String(d.chainId)||ethers.getAddress(snapshot.membership)!==ethers.getAddress(d.membership))throw Error('Invalid snapshot provenance');
 const scores=new Map(),seen=new Set();
 for(const x of snapshot.memberships){
  if(!Number.isInteger(x.id)||x.id<1||x.id>4444||seen.has(x.id)||!Number.isInteger(x.level)||x.level<0||x.level>5)throw Error('Invalid/duplicate membership');
  seen.add(x.id);const a=ethers.getAddress(x.owner);if(a===ethers.ZeroAddress)throw Error('Zero owner');
  scores.set(a,(scores.get(a)||0n)+weights[x.level]);
 }
 const total=[...scores.values()].reduce((a,b)=>a+b,0n);if(!total)throw Error('No eligible weight');
 if(budget<total)throw Error('Budget below total points in smallest token units');
 const rows=[...scores].sort(([a],[b])=>a.toLowerCase().localeCompare(b.toLowerCase()))
  .map(([account,score])=>({account,points:score.toString(),amount:(budget*score/total).toString()})).filter(x=>BigInt(x.amount)>0n);
 if(!rows.length)throw Error('Budget too small');
 const layers=[rows.map(x=>rewardLeaf(d,x.account,x.points))];
 while(layers.at(-1).length>1){const last=layers.at(-1),next=[];for(let i=0;i<last.length;i+=2)next.push(i+1<last.length?pair(last[i],last[i+1]):last[i]);layers.push(next);}
 rows.forEach((x,i)=>{x.proof=[];for(let l=0;l<layers.length-1;l++){const sibling=i^1;if(sibling<layers[l].length)x.proof.push(layers[l][sibling]);i=Math.floor(i/2);}});
 const allocated=rows.reduce((a,x)=>a+BigInt(x.amount),0n);
 return {schema:'cofferhouse-rewards-v1',domain:d,snapshotBlock:snapshot.blockNumber,snapshotBlockHash:snapshot.blockHash,
  pointScale:2,displayWeights:['0','1','2','3.5','5','8'],weights:weights.map(String),root:layers.at(-1)[0],budget:budget.toString(),totalPoints:total.toString(),allocated:allocated.toString(),unallocatedRounding:(budget-allocated).toString(),claims:rows};
}
// JSON integers for money MUST be decimal strings in smallest ERC20 units.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [inputPath,outPath]=process.argv.slice(2);if(!inputPath||!outPath)throw Error('node scripts/rewards.mjs input.json output.json');
 const x=JSON.parse(fs.readFileSync(inputPath));const m=makeManifest(x.domain,x.snapshot,x.weights,x.budget);
 const bytes=JSON.stringify(m,null,2)+'\n';fs.writeFileSync(outPath,bytes,{flag:'wx'});
 console.log(JSON.stringify({root:m.root,budget:m.budget,manifestHash:ethers.keccak256(ethers.toUtf8Bytes(bytes))}));
}
