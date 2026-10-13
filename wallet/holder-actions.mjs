// Integration adapter. Caller supplies ethers.Contract objects connected to signer.
// Never requests private keys; the caller's wallet handles all signatures.
export async function ascendMembership(nft,token,id){
 const signer=nft.runner,account=await signer.getAddress();
 if((await nft.ownerOf(id)).toLowerCase()!==account.toLowerCase())throw Error('Not membership owner');
 if(!await nft.ascensionEnabled())throw Error('Ascension is disabled');
 if((await nft.burnToken()).toLowerCase()!==(await token.getAddress()).toLowerCase())throw Error('Wrong burn token');
 const level=Number(await nft.tier(id));if(level>=5)throw Error('Maximum level');
 const cost=await nft.ascendCost(level+1);
 const allowance=await token.allowance(account,await nft.getAddress());
 if(allowance<cost){
  if(allowance>0n)await(await token.approve(await nft.getAddress(),0)).wait();
  await(await token.approve(await nft.getAddress(),cost)).wait();
 }
 return (await (level===0?nft.activate(id):nft.ascend(id))).wait();
}
export async function sacrificeMemberships(nft,survivor,ids){
 if(!ids.length||new Set(ids.map(String)).size!==ids.length||ids.map(String).includes(String(survivor)))throw Error('Invalid sacrifice IDs');
 // User flow must display burned IDs and obtain explicit confirmation BEFORE calling.
 return (await nft.cannibalize(survivor,ids)).wait();
}
export async function claimReward(distributor,manifest,account){
 const d=manifest.domain;
 if((await distributor.getAddress()).toLowerCase()!==d.distributor.toLowerCase())throw Error('Wrong distributor');
 const network=await distributor.runner.provider.getNetwork();
 if(String(network.chainId)!==String(d.chainId))throw Error('Wrong network');
 if((await distributor.membership()).toLowerCase()!==d.membership.toLowerCase())throw Error('Wrong membership');
 const epoch=await distributor.epochs(d.epoch);
 if(epoch.root!==manifest.root||epoch.token.toLowerCase()!==d.token.toLowerCase())throw Error('Wrong epoch/manifest');
 const c=manifest.claims.find(x=>x.account.toLowerCase()===account.toLowerCase());
 if(!c)throw Error('No rewards for this wallet');
 return (await distributor.claim(d.epoch,c.account,c.points,c.proof)).wait();
}
