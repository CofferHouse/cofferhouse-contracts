import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {ethers} from 'ethers';
import {makeManifest, LEVEL_WEIGHTS} from './rewards.mjs';

// The independent input contains the reviewed snapshot and intended domain.
// Rebuilding catches modified amounts, omitted wallets, proofs and policy fields.
export function verifyManifest(input, bytes) {
  const manifest = JSON.parse(bytes);
  if (manifest.schema !== 'cofferhouse-rewards-v1') throw Error('Unknown manifest schema');
  const domain = input.domain;
  for (const key of ['distributor', 'membership', 'token']) {
    if (!ethers.isAddress(domain[key]) || ethers.getAddress(domain[key]) === ethers.ZeroAddress) throw Error(`Invalid ${key}`);
  }
  for (const key of ['chainId', 'epoch']) {
    if (!/^[1-9][0-9]*$/.test(String(domain[key])) || BigInt(domain[key]) > ethers.MaxUint256) throw Error(`Invalid ${key}`);
  }
  if (typeof input.budget !== 'string' || !/^[1-9][0-9]*$/.test(input.budget) || BigInt(input.budget) > ethers.MaxUint256) throw Error('Budget must be a positive uint256 decimal string');
  if (!Number.isSafeInteger(input.snapshot.blockNumber) || input.snapshot.blockNumber < 0) throw Error('Invalid snapshot block');
  const expected = makeManifest(domain, input.snapshot, input.weights, input.budget);
  if (!isDeepStrictEqual(manifest, expected)) throw Error('Manifest differs from reviewed snapshot, domain or allocation policy');
  const hash = ethers.keccak256(ethers.toUtf8Bytes(bytes));
  return {
    root: manifest.root, manifestHash: hash, budget: manifest.budget,
    totalPoints: manifest.totalPoints, snapshotBlock: manifest.snapshotBlock,
    beneficiaries: manifest.claims.length,
    allocated: manifest.allocated, rounding: manifest.unallocatedRounding,
    publishArgs: [domain.token, manifest.root, manifest.budget, manifest.snapshotBlock, hash, manifest.totalPoints]
  };
}

// Check historical completeness as well as the present publication conditions.
// Reads only: no signer, no private key and no transaction broadcast.
export async function verifyPublication(input, report, rpc) {
  const provider = new ethers.JsonRpcProvider(rpc);
  try {
    const domain = input.domain;
    if ((await provider.getNetwork()).chainId !== BigInt(domain.chainId)) throw Error('Wrong RPC chain');
    const currentBlock = await provider.getBlockNumber();
    if (input.snapshot.blockNumber >= currentBlock) throw Error('Snapshot must be a past block');
    const snapshotBlock = await provider.getBlock(input.snapshot.blockNumber);
    if (!snapshotBlock || snapshotBlock.hash.toLowerCase() !== input.snapshot.blockHash.toLowerCase()) throw Error('Snapshot block hash differs');
    const historical = {blockTag: input.snapshot.blockNumber};
    const nft = new ethers.Contract(domain.membership, [
      'function getMintStats(address) view returns(uint256,uint256,uint256)',
      'function ownerOf(uint256) view returns(address)', 'function tier(uint256) view returns(uint8)'
    ], provider);
    const [, minted] = await nft.getMintStats(ethers.ZeroAddress, historical);
    if (minted > 4444n) throw Error('Unexpected membership supply');
    const listed = new Map(input.snapshot.memberships.map(x => [x.id, x]));
    for (let id = 1; id <= Number(minted); id++) {
      let owner;
      try { owner = await nft.ownerOf(id, historical); }
      catch (error) {
        if (error.code === 'CALL_EXCEPTION' && error.data === '0xdf2d9b42') {
          if (listed.has(id)) throw Error(`Burned membership ${id} is listed`);
          continue;
        }
        throw error;
      }
      const row = listed.get(id);
      if (!row || ethers.getAddress(row.owner) !== ethers.getAddress(owner) || row.level !== Number(await nft.tier(id, historical))) throw Error(`Historical membership ${id} differs or is missing`);
      listed.delete(id);
    }
    if (listed.size) throw Error('Snapshot contains unminted memberships');
    const at = {blockTag: currentBlock};
    const rewards = new ethers.Contract(domain.distributor, [
      'function membership() view returns(address)', 'function owner() view returns(address)',
      'function paused() view returns(bool)', 'function nextEpoch() view returns(uint256)',
      'function reserved(address) view returns(uint256)', 'function levelWeight(uint8) view returns(uint256)'
    ], provider);
    const token = new ethers.Contract(domain.token, [
      'function decimals() view returns(uint8)', 'function balanceOf(address) view returns(uint256)'
    ], provider);
    if (ethers.getAddress(await rewards.membership(at)) !== ethers.getAddress(domain.membership)) throw Error('Rewards bound to another collection');
    if (await rewards.paused(at)) throw Error('Rewards publication paused');
    if (await rewards.nextEpoch(at) !== BigInt(domain.epoch)) throw Error('Epoch has changed; rebuild the manifest');
    for (let i = 0; i < LEVEL_WEIGHTS.length; i++) {
      if (await rewards.levelWeight(i, at) !== BigInt(LEVEL_WEIGHTS[i])) throw Error('Onchain reward weights differ');
    }
    const reserved = await rewards.reserved(domain.token, at);
    const balance = await token.balanceOf(domain.distributor, at);
    if (balance < reserved + BigInt(report.budget)) throw Error('Insufficient unreserved reward funds');
    // Re-read the historical header without the provider cache.
    const finalHeader = await provider.send('eth_getBlockByNumber', [ethers.toQuantity(input.snapshot.blockNumber), false]);
    if (!finalHeader || finalHeader.hash.toLowerCase() !== snapshotBlock.hash.toLowerCase()) throw Error('Snapshot block changed during verification');
    return {checkedAtBlock: currentBlock, publisher: await rewards.owner(at), tokenDecimals: Number(await token.decimals(at)), balance: balance.toString(), reserved: reserved.toString()};
  } finally { provider.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [inputPath, manifestPath] = process.argv.slice(2);
    if (!inputPath || !manifestPath) throw Error('node scripts/verify-rewards.mjs reviewed-input.json exact-manifest.json');
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const report = verifyManifest(input, fs.readFileSync(manifestPath, 'utf8'));
    const live = process.env.REWARDS_RPC ? await verifyPublication(input, report, process.env.REWARDS_RPC) : null;
    console.log(JSON.stringify({localVerified: true, liveVerified: live !== null, ...report, live, scope: 'Read-only checks; recheck before signing. Does not prove token safety or source identity.'}, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
