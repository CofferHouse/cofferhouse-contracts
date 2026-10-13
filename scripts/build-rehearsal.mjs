import fs from 'node:fs';
import solc from 'solc';
const input={language:'Solidity',sources:{'Fixtures.sol':{content:fs.readFileSync('rehearsal/TestnetFixtures.sol','utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'london',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const out=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>({contents:fs.readFileSync('vendor/'+p,'utf8')})}));
if((out.errors||[]).some(x=>x.severity==='error'))throw Error(JSON.stringify(out.errors));
const a=JSON.parse(fs.readFileSync('wallet/artifact.json')),r=JSON.parse(fs.readFileSync('wallet/rewards-artifact.json'));
const normal=c=>({abi:c.abi,bytecode:'0x'+c.evm.bytecode.object});
fs.writeFileSync('rehearsal/artifacts.json',JSON.stringify({membership:{abi:a.abi,bytecode:a.bytecode},rewards:normal(r),token:normal(out.contracts['Fixtures.sol'].TestCOFFERS),relay:normal(out.contracts['Fixtures.sol'].TestMintRelay)},null,2));
console.log('Rehearsal fixtures compiled; Arc testnet only.');
