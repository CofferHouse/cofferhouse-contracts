import assert from 'node:assert/strict';
import fs from 'node:fs';
import solc from 'solc';
import ganache from 'ganache';
import {ethers} from 'ethers';
import {makeManifest, LEVEL_WEIGHTS} from '../scripts/rewards.mjs';
import {verifyManifest, verifyPublication} from '../scripts/verify-rewards.mjs';
const sources = {
  'Rewards.sol': {content: fs.readFileSync('src/CofferHouseRewards.sol', 'utf8')},
  'Mocks.sol': {content: `pragma solidity ^0.8.17;
import "openzeppelin-contracts/token/ERC20/ERC20.sol";
contract Token is ERC20 { constructor() ERC20("Test USDC","T"){_mint(msg.sender,10000000);} function decimals() public pure override returns(uint8){return 6;} }
contract Membership {
 error OwnerQueryForNonexistentToken();
 address public holder; constructor(){holder=msg.sender;}
 function getMintStats(address) public pure returns(uint256,uint256,uint256){return(0,4,4444);}
 function ownerOf(uint256 id) public view returns(address){if(id==3||id==0||id>4) revert OwnerQueryForNonexistentToken();return holder;}
 function tier(uint256 id) public pure returns(uint8){return id==1?1:id==2?3:0;}
}`}
};
const output = JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'london',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}), {import:p=>({contents:fs.readFileSync('vendor/'+p,'utf8')})}));
assert.ok(!(output.errors ?? []).some(e=>e.severity==='error'));
const server = ganache.server({logging:{quiet:true},chain:{chainId:1337},wallet:{totalAccounts:2}});
await server.listen(0, '127.0.0.1');
const rpc = `http://127.0.0.1:${server.address().port}`;
const provider = new ethers.JsonRpcProvider(rpc, undefined, {cacheTimeout:-1});
provider.pollingInterval = 10;
try {
  const owner = await provider.getSigner(0), account = await owner.getAddress();
  const deploy = async (artifact,args=[]) => {
    const contract = await new ethers.ContractFactory(artifact.abi,artifact.evm.bytecode.object,owner).deploy(...args);
    await contract.waitForDeployment();return contract;
  };
  const tx = async promise => (await promise).wait();
  const membership = await deploy(output.contracts['Mocks.sol'].Membership);
  const token = await deploy(output.contracts['Mocks.sol'].Token);
  const rewards = await deploy(output.contracts['Rewards.sol'].CofferHouseRewards,[await membership.getAddress(),account]);
  const block = await provider.getBlock('latest');
  const input = {
    domain:{chainId:'1337',epoch:'1',membership:await membership.getAddress(),token:await token.getAddress(),distributor:await rewards.getAddress()},
    snapshot:{chainId:'1337',membership:await membership.getAddress(),blockNumber:block.number,blockHash:block.hash,memberships:[{id:1,owner:account,level:1},{id:2,owner:account,level:3},{id:4,owner:account,level:0}]},
    weights:LEVEL_WEIGHTS,budget:'1000000'
  };
  const reportFor = x => verifyManifest(x,JSON.stringify(makeManifest(x.domain,x.snapshot,x.weights,x.budget)));
  const report = reportFor(input);
  await tx(token.transfer(await rewards.getAddress(),1000000));
  const live = await verifyPublication(input,report,rpc);
  assert.equal(live.tokenDecimals,6);assert.equal(live.publisher,account);assert.equal(live.reserved,'0');
  let checks=3;
  const reject = async (x,pattern) => {await assert.rejects(verifyPublication(x,reportFor(x),rpc),pattern);checks++;};
  await reject({...input,snapshot:{...input.snapshot,memberships:input.snapshot.memberships.filter(x=>x.id!==4)}},/missing/);
  const other = await (await provider.getSigner(1)).getAddress();
  await reject({...input,snapshot:{...input.snapshot,memberships:input.snapshot.memberships.map(x=>x.id===1?{...x,owner:other}:x)}},/differs/);
  await reject({...input,snapshot:{...input.snapshot,memberships:[...input.snapshot.memberships,{id:3,owner:account,level:0}]}},/Burned/);
  await reject({...input,snapshot:{...input.snapshot,blockHash:ethers.ZeroHash}},/block hash/);
  await reject({...input,budget:'2000000'},/Insufficient/);
  await tx(rewards.setPaused(true));await reject(input,/paused/);await tx(rewards.setPaused(false));
  await tx(rewards.publishEpoch(...report.publishArgs));
  await reject(input,/Epoch has changed/);
  await reject({...input,domain:{...input.domain,epoch:'2'}},/Insufficient/);
  console.log(`Rewards live publication: ${checks} checks passed (local Ganache only)`);
} finally {provider.destroy();await server.close();}
