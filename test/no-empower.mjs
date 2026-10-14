import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import os from 'node:os';
import {membershipMetadata} from '../scripts/metadata-service.mjs';
import {createRequire} from 'node:module';
const require = createRequire(process.env.COFFER_DEPENDENCIES || import.meta.url);
const solc=require('solc'), ganache=require('ganache'), {ethers}=require('ethers');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const sources={
 'CofferHouseSeaDrop.sol':{content:fs.readFileSync(root+'/candidates/CofferHouseSeaDrop.sol','utf8')},
 'SeaDrop.sol':{content:'pragma solidity ^0.8.17; import "seadrop/SeaDrop.sol";'},
 'Token.sol':{content:'pragma solidity ^0.8.17; import "openzeppelin-contracts/token/ERC20/ERC20.sol"; contract Token is ERC20 { constructor() ERC20("Test","T") { _mint(msg.sender, 1000000000 ether); } }'}
};
const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'london',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{
 try{return {contents:fs.readFileSync(root+'/vendor/'+p,'utf8')}}catch{return {error:'Missing '+p}}
}}));
const errors=(output.errors||[]).filter(x=>x.severity==='error');
if(errors.length) throw Error(errors.map(x=>x.formattedMessage).join('\n'));
const artifact=output.contracts['CofferHouseSeaDrop.sol'].CofferHouseSeaDrop;
const bytes=artifact.evm.deployedBytecode.object.length/2;
assert(bytes<=24576, 'EIP-170 bytecode limit');
console.log('Compiled solc',solc.version(),'runtime bytes',bytes);
const rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai',chainId:process.env.SEADROP_RUNTIME_FILE?5042:1337},wallet:{totalAccounts:3}});
const provider=new ethers.BrowserProvider(rpc, undefined, {cacheTimeout: -1}); provider.pollingInterval=10;
const owner=await provider.getSigner(0), other=await provider.getSigner(1), fee=await provider.getSigner(2);
const a=await owner.getAddress(), b=await other.getAddress(), f=await fee.getAddress();
async function deploy(c,args=[]){const x=await new ethers.ContractFactory(c.abi,c.evm.bytecode.object,owner).deploy(...args);await x.waitForDeployment();return x;}
async function tx(p){await (await p).wait();}
async function rejects(p){await assert.rejects(async()=>{const t=await p; if(t?.wait) await t.wait();});checks++;}
let checks=0;
let sd,s;
if(process.env.SEADROP_RUNTIME_FILE){
 s='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
 const runtime=fs.readFileSync(process.env.SEADROP_RUNTIME_FILE,'utf8').trim();
 assert.match(runtime,/^0x[0-9a-fA-F]+$/);
 await rpc.request({method:'evm_setAccountCode',params:[s,runtime]});
 // Runtime injection skips the constructor. Reproduce Solmate's initial
 // unlocked state (slot 0 = 1); all collection configuration starts empty.
 await rpc.request({method:'evm_setAccountStorageAt',params:[s,ethers.ZeroHash,ethers.zeroPadValue('0x01',32)]});
 sd=new ethers.Contract(s,output.contracts['seadrop/SeaDrop.sol'].SeaDrop.abi,owner);
 console.log('Testing supplied Arc runtime locally; no live Arc connection.');
}else{
 sd=await deploy(output.contracts['seadrop/SeaDrop.sol'].SeaDrop);s=await sd.getAddress();
}
const nft=await deploy(artifact,['CofferHouse','COFFER',[s]]), n=await nft.getAddress();
const token=await deploy(output.contracts['Token.sol'].Token), t=await token.getAddress();
await tx(nft.updateCreatorPayoutAddress(s,a));
await tx(nft.updatePublicDrop(s,[0,1,9999999999,4444,0,false]));
await tx(nft.setBaseURI('ipfs://hidden.json'));
await tx(nft.updateAllowedFeeRecipient(s,f,true));
const reserveParams=[0,100,1,9999999999,1,100,0,true];
const reserveRoot=ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address','tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)'],[a,reserveParams]));
await tx(nft.updateAllowList(s,[reserveRoot,[], '']));
await rejects(sd.connect(other).mintAllowList(n,f,ethers.ZeroAddress,1,reserveParams,[]));
await tx(sd.mintAllowList(n,f,ethers.ZeroAddress,100,reserveParams,[]));
await rejects(sd.mintAllowList(n,f,ethers.ZeroAddress,1,reserveParams,[]));
assert.equal(await nft.totalSupply(),100n);checks++;
assert.equal(await nft.tokenURI(1),'ipfs://hidden.json');checks++;
await rejects(nft.activate(1));
await rejects(nft.connect(other).mintSeaDrop(b,1));
await tx(nft.setAscendedBaseURI('ipfs://ascended/'));
await tx(nft.configureAscension(t,true));
await tx(token.approve(n,ethers.MaxUint256));
await rejects(nft.connect(other).activate(1));
await tx(nft.activate(1));
assert.equal(await nft.tier(1),1n);checks++;
assert.equal(await nft.tokenURI(1),'ipfs://ascended/1/1.json');checks++;
assert.equal(await token.balanceOf(await nft.DEAD()),20000n*10n**18n);checks++;
await rejects(nft.activate(1));
await rejects(nft.cannibalize(1,[1]));
await rejects(nft.cannibalize(1,[]));
await rejects(nft.cannibalize(2,[3])); // no activation by sacrifice
let next=4;
async function level(id,target){if(target) await tx(nft.activate(id));for(let i=1;i<target;i++) await tx(nft.ascend(id));}
for(let target=2;target<=5;target++){
 for(let count=1;count<=target;count++){
  const survivor=next++, ids=[];await level(survivor,target-1);
  for(let i=0;i<count;i++){const id=next++;ids.push(id);await level(id,target-count);}
  const before=await nft.totalSupply();
  await tx(nft.cannibalize(survivor,ids));
  assert.equal(await nft.tier(survivor),BigInt(target));
  assert.equal(await nft.totalSupply(),before-BigInt(count));
  for(const id of ids) await rejects(nft.ownerOf(id));
  checks++;console.log('PASS target',target,'sacrifices',count,'tier',target-count);
 }
}
const survivor=next++, sac=next++;await level(survivor,1);
const before=await nft.totalSupply();
await rejects(nft.cannibalize(survivor,[sac,sac]));
assert.equal(await nft.totalSupply(),before);assert.equal(await nft.ownerOf(sac),a);checks++;
await rejects(nft.cannibalize(survivor,[sac])); // N0 cannot replace required N1
assert.equal(nft.interface.getFunction('empower'),null);checks++;
assert.equal(nft.interface.getFunction('empoweredUntil'),null);checks++;
const legacy=new ethers.Interface(['function empower(uint256,uint256)']);
for(const signer of [owner,other])for(const amount of [0n,1n,20000n*10n**18n]) {
 await rejects(signer.sendTransaction({to:n,data:legacy.encodeFunctionData('empower',[survivor,amount]),gasLimit:100000}));
}
assert.equal(await nft.tier(survivor),1n);checks++;
await tx(nft.transferFrom(a,b,survivor));await rejects(nft.ascend(survivor));

await tx(nft.setBaseURI('ipfs://revealed/'));
assert.equal(await nft.tokenURI(2),'ipfs://revealed/2');checks++;
const stats=await nft.getMintStats(a);assert.equal(stats[1],100n);checks++;
await tx(nft.setMaxSupply(100));await rejects(sd.mintPublic(n,f,ethers.ZeroAddress,1)); // burns do not reopen mint slots
await tx(nft.setMaxSupply(5000));
await tx(nft.updatePublicDrop(s,[0,1,9999999999,65535,0,false]));
await rejects(sd.mintPublic(n,f,ethers.ZeroAddress,4345)); // hard 4444 cap despite admin raising cap
const paid=await deploy(artifact,['Paid','P',[s]]), paidAddress=await paid.getAddress();
await tx(paid.updateCreatorPayoutAddress(s,a));
await tx(paid.updateAllowedFeeRecipient(s,f,true));
const price=ethers.parseEther('1');
await tx(paid.updatePublicDrop(s,[price,1,9999999999,2,1000,true]));
await rejects(sd.connect(other).mintPublic(paidAddress,f,ethers.ZeroAddress,1,{value:price-1n}));
const beforeFee=await provider.getBalance(f),beforePayout=await provider.getBalance(a);
await tx(sd.connect(other).mintPublic(paidAddress,f,ethers.ZeroAddress,1,{value:price}));
assert.equal(await provider.getBalance(f)-beforeFee,price/10n);checks++;
assert.equal(await provider.getBalance(a)-beforePayout,price*9n/10n);checks++;
assert.equal(await paid.ownerOf(1),b);checks++;
await rejects(sd.connect(other).mintPublic(paidAddress,f,ethers.ZeroAddress,2,{value:price*2n}));
const metadataDir=fs.mkdtempSync(path.join(os.tmpdir(),'coffer-chain-meta-'));
try {
 fs.writeFileSync(path.join(metadataDir,'1'),JSON.stringify({name:'Original artwork',image:'ipfs://unchanged.png',attributes:[{trait_type:'Color',value:'Blue'}]}));
 const doc=await membershipMetadata(nft,metadataDir,1,1);
 assert.equal(doc.image,'ipfs://unchanged.png');assert.equal(doc.attributes[1].value,1);checks++;
 await assert.rejects(membershipMetadata(nft,metadataDir,2,1));checks++;
 await assert.rejects(membershipMetadata(nft,metadataDir,1,4445));checks++;
} finally {fs.rmSync(metadataDir,{recursive:true,force:true});}
console.log('PASS',checks,'assertions/revert checks; real SeaDrop exercised locally.');
fs.mkdirSync(root+'/validation',{recursive:true});
fs.writeFileSync(root+'/validation/'+'no-empower-results.json',JSON.stringify({compiler:solc.version(),runtimeBytes:bytes,checks,seadrop:process.env.SEADROP_RUNTIME_FILE?'user-supplied Arc runtime':'757590f11babfd81f4608f736e79e388469377f2',network:'local Ganache; NOT live Arc/Studio verification'},null,2));
await rpc.disconnect();
