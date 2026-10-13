import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(process.env.COFFER_DEPENDENCIES||import.meta.url),{ethers}=require('ethers');
export async function membershipMetadata(collection,directory,requestedTier,id){
 if(!Number.isInteger(id)||id<1||id>4444||!Number.isInteger(requestedTier)||requestedTier<1||requestedTier>5)throw Error('Invalid membership');
 await collection.ownerOf(id); // Burned NFTs have no metadata.
 if(Number(await collection.tier(id))!==requestedTier)throw Error('Tier does not match chain');
 const base=JSON.parse(await fs.readFile(path.join(directory,String(id)),'utf8'));
 const attrs=(base.attributes||[]).filter(x=>x.trait_type!=='Ascension level');
 return {...base,attributes:[...attrs,{trait_type:'Ascension level',value:requestedTier}]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {ARC_RPC_URL,NFT_ADDRESS,REVEAL_DIRECTORY,PORT='8080'}=process.env;
 if(!ARC_RPC_URL||!NFT_ADDRESS||!REVEAL_DIRECTORY)throw Error('Set ARC_RPC_URL, NFT_ADDRESS, REVEAL_DIRECTORY');
 const provider=new ethers.JsonRpcProvider(ARC_RPC_URL);
 const nft=new ethers.Contract(NFT_ADDRESS,['function ownerOf(uint256) view returns(address)','function tier(uint256) view returns(uint8)'],provider);
 const server=http.createServer(async(req,res)=>{
  const match=/^\/metadata\/([1-5])\/(\d+)\.json$/.exec((req.url||'').split('?')[0]);
  if(req.method!=='GET'||!match){res.writeHead(404);res.end();return;}
  try{const doc=await membershipMetadata(nft,REVEAL_DIRECTORY,Number(match[1]),Number(match[2]));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-cache'});res.end(JSON.stringify(doc));}
  catch(error){res.writeHead(404,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Membership metadata unavailable'}));console.error(error.message);}
 });server.listen(Number(PORT),'127.0.0.1',()=>console.log('Metadata service listening on 127.0.0.1:'+PORT+'; configure an HTTPS reverse proxy.'));
}
