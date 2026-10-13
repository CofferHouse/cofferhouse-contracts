import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import solc from 'solc';
import ganache from 'ganache';
import {ethers} from 'ethers';
const input={language:'Solidity',sources:{'Fixtures.sol':{content:fs.readFileSync('rehearsal/TestnetFixtures.sol','utf8')},'USDC.sol':{content:'pragma solidity ^0.8.17; import "openzeppelin-contracts/token/ERC20/ERC20.sol"; contract TestUSDC is ERC20 {constructor() ERC20("Test USDC","USDC"){_mint(msg.sender,10000000);}function decimals() public pure override returns(uint8){return 6;}}'}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'london',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>({contents:fs.readFileSync('vendor/'+p,'utf8')})}));
assert(!(output.errors||[]).some(e=>e.severity==='error'));
const arts=JSON.parse(fs.readFileSync('rehearsal/artifacts.json'));
const rpc=ganache.provider({logging:{quiet:true},chain:{chainId:5042002},wallet:{totalAccounts:2}}),provider=new ethers.BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
const signer=await provider.getSigner(0),other=await provider.getSigner(1),account=await signer.getAddress();let checks=0;
const tx=async p=>{await(await p).wait();};
async function deploy(c,args=[]){const bytecode=c.bytecode||'0x'+c.evm.bytecode.object,x=await new ethers.ContractFactory(c.abi,bytecode,signer).deploy(...args);await x.waitForDeployment();return x;}
const relay=await deploy(arts.relay),nft=await deploy(arts.membership,['CofferHouse rehearsal','TESTKEY',[await relay.getAddress()]]),token=await deploy(arts.token),r=await deploy(arts.rewards,[await nft.getAddress(),account]),usdc=await deploy(output.contracts['USDC.sol'].TestUSDC);
await assert.rejects(relay.connect(other).mint(await nft.getAddress(),account,5));checks++;
await tx(relay.mint(await nft.getAddress(),account,5));
await tx(nft.setAscendedBaseURI('https://example.invalid/cofferhouse-test/'));
await tx(nft.configureAscension(await token.getAddress(),true));
for(const id of [1,4]){await tx(token.approve(await nft.getAddress(),await nft.ascendCost(1)));await tx(nft.activate(id));}
await tx(token.approve(await nft.getAddress(),await nft.ascendCost(2)));await tx(nft.ascend(1));await tx(nft.cannibalize(4,[2,3]));
assert.equal(await nft.tier(1),2n);assert.equal(await nft.tier(4),2n);assert.equal(await nft.tier(5),0n);checks+=3;
assert.equal(await nft.totalSupply(),3n);checks++;
assert.equal(await token.balanceOf(await nft.DEAD()),120000n*10n**18n);checks++;
for(const id of [2,3]){await assert.rejects(nft.ownerOf(id));checks++;}
const points=(await r.levelWeight(await nft.tier(1)))+(await r.levelWeight(await nft.tier(4)))+(await r.levelWeight(await nft.tier(5)));assert.equal(points,8n);checks++;
await tx(usdc.transfer(await r.getAddress(),1000000));
const epoch=await r.nextEpoch(),block=await provider.getBlock('latest'),root=ethers.keccak256(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256','address','address','uint256','address','address','uint256'],[5042002,await r.getAddress(),await nft.getAddress(),epoch,await usdc.getAddress(),account,points])));
await tx(r.publishEpoch(await usdc.getAddress(),root,1000000,block.number,ethers.keccak256(ethers.toUtf8Bytes('rehearsal')),points));
await assert.rejects(r.claim(epoch,account,points,[]));checks++;
await rpc.request({method:'evm_increaseTime',params:[86401]});await rpc.request({method:'evm_mine',params:[]});
await tx(r.connect(other).claim(epoch,account,points,[]));assert.equal(await usdc.balanceOf(account),10000000n);assert.equal(await r.reserved(await usdc.getAddress()),0n);checks+=2;
await assert.rejects(r.claim(epoch,account,points,[]));checks++;
const html=fs.readFileSync('rehearsal/index.html','utf8'),scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];for(const s of scripts)if(s[1])new vm.Script(s[1]);checks++;
console.log('PASS rehearsal:',checks,'checks; local Ganache, NOT an Arc network deployment');
fs.writeFileSync('validation/rehearsal-results.json',JSON.stringify({checks,chainId:5042002,network:'local Ganache with testnet chainId; NOT live Arc',covered:'test relay, actual NFT ascension, USDC mock, funded epoch, 24h review, claim and replay'},null,2));await rpc.disconnect();
