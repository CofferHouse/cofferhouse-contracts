import fs from 'node:fs';
import {ethers} from 'ethers';
const [rpcUrl,nftAddress,blockText,outPath]=process.argv.slice(2);
if(!rpcUrl||!nftAddress||!blockText||!outPath)throw Error('node scripts/rewards-snapshot.mjs RPC NFT BLOCK output.json');
const blockNumber=Number(blockText);if(!Number.isSafeInteger(blockNumber)||blockNumber<0)throw Error('Invalid block');
const provider=new ethers.JsonRpcProvider(rpcUrl),network=await provider.getNetwork();
const block=await provider.getBlock(blockNumber);if(!block)throw Error('Missing snapshot block');
const nft=new ethers.Contract(nftAddress,['function getMintStats(address) view returns(uint256,uint256,uint256)','function ownerOf(uint256) view returns(address)','function tier(uint256) view returns(uint8)'],provider);
const [,minted]=await nft.getMintStats(ethers.ZeroAddress,{blockTag:blockNumber});
if(minted>4444n)throw Error('Unexpected collection supply');
const memberships=[];
for(let id=1;id<=Number(minted);id++){
 let owner;
 try{owner=await nft.ownerOf(id,{blockTag:blockNumber});}catch(e){
  // Only the deployed ERC721A burned/nonexistent selector is skipped.
  if(e.code==='CALL_EXCEPTION'&&e.data==='0xdf2d9b42')continue;
  throw e;
 }
 const level=Number(await nft.tier(id,{blockTag:blockNumber}));memberships.push({id,owner,level});
}
const finalBlock=await provider.getBlock(blockNumber);
if(finalBlock.hash!==block.hash)throw Error('Snapshot reorg: retry');
const snapshot={chainId:network.chainId.toString(),membership:ethers.getAddress(nftAddress),blockNumber,blockHash:block.hash,totalMinted:minted.toString(),memberships};
fs.writeFileSync(outPath,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});console.log('Snapshot saved:',memberships.length,'live memberships');
