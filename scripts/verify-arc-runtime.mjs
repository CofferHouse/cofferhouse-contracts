import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.COFFER_DEPENDENCIES||import.meta.url);
const solc=require('solc'),{ethers}=require('ethers');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const supplied=fs.readFileSync(root+'/verification/arc/seadrop-runtime.hex','utf8').trim();
const address='0x00005EA00Ac477B1030CE78506496e8C2dE24bf5';
const input={language:'Solidity',sources:{'seadrop/SeaDrop.sol':{content:fs.readFileSync(root+'/verification/arc/SeaDrop-v1.sol','utf8')}},settings:{optimizer:{enabled:true,runs:1000000},evmVersion:'london',outputSelection:{'*':{'*':['evm.deployedBytecode']}}}};
const out=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{try{return {contents:fs.readFileSync(root+'/vendor/'+p.replace('openzeppelin-contracts/contracts/','openzeppelin-contracts/'),'utf8')}}catch{return {error:p}}}}));
assert.equal((out.errors||[]).filter(x=>x.severity==='error').length,0);
const artifact=out.contracts['seadrop/SeaDrop.sol'].SeaDrop.evm.deployedBytecode;
const actual=supplied.slice(2);
let expected=artifact.object;
const domain=ethers.TypedDataEncoder.hashDomain({name:'SeaDrop',version:'1.0',chainId:5042,verifyingContract:address}).slice(2);
const chain=ethers.zeroPadValue(ethers.toBeHex(5042),32).slice(2);
const immutableValues=[];
for(const refs of Object.values(artifact.immutableReferences))for(const r of refs){
 const value=actual.slice(r.start*2,(r.start+r.length)*2);
 assert.ok(value===chain||value===domain,'Unexpected deployed immutable');
 immutableValues.push({offset:r.start,value});
 expected=expected.slice(0,r.start*2)+value+expected.slice((r.start+r.length)*2);
}
assert.equal(immutableValues.length,2);
assert.ok(immutableValues.some(x=>x.value===chain));assert.ok(immutableValues.some(x=>x.value===domain));
function executable(hex){const metadataBytes=parseInt(hex.slice(-4),16);return hex.slice(0,-(metadataBytes+2)*2);}
assert.equal(executable(actual),executable(expected),'Executable code differs');
const report={address,chainId:5042,sourceOrigin:'ProjectOpenSea/seadrop tag seadrop-1.0',sourceCommit:'368b005b78cbcf35752983eb257afe3a37387285',compiler:solc.version(),optimizerRuns:1000000,evmVersion:'london',runtimeBytes:actual.length/2,runtimeKeccak256:ethers.keccak256(supplied),executableExactMatch:true,immutableChainAndDomainMatch:true,immutableValues,metadataExactMatch:actual===expected,evidence:'Bytecode supplied by user from Arc explorer screenshot; no independent live RPC retrieval. Solidity metadata excluded, deployed immutables validated against expected chain/address. SeaDrop-v1 source is official tag, dependencies use bundled versions whose executable output matches.',scope:'Code identity; does not prove Studio recognizes the custom CofferHouse collection, audit the extension, or constitute a live Arc mint.'};
fs.writeFileSync(root+'/validation/arc-runtime-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
