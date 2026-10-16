import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ethers} from 'ethers';

const membershipAddress = '0xBdAAD4B289b65B572E231e548278B9451A13f0FE';
const costs = ['20000', '80000', '320000', '1000000', '2000000'];
const weights = [0, 2, 4, 7, 10, 16];
const testAddresses = new Set([
  '0x9f439d557355674f22e8f2a8babbf22a1122f24a',
  '0xd554aa76030dc7f18db5c6fe1d798c89a1d596bf',
  '0x91c838c6c2f1d63900c3cbeb980b2012b747f9f4'
]);

export function validateLaunch(config) {
  const errors = [];
  if (config.chainId !== 5042) errors.push('Expected Arc mainnet chain 5042');
  for (const key of ['membership', 'coffers', 'rewards', 'membershipOwner', 'rewardsOwner']) {
    const value = config[key];
    if (!ethers.isAddress(value ?? '') || value.toLowerCase() === ethers.ZeroAddress) errors.push(`Missing or invalid ${key}`);
    else if (testAddresses.has(value.toLowerCase())) errors.push(`Testnet address forbidden: ${key}`);
  }
  if (config.membership?.toLowerCase() !== membershipAddress.toLowerCase()) errors.push('Preserve the existing membership collection');
  if (!Number.isInteger(config.coffersDecimals) || config.coffersDecimals < 0 || config.coffersDecimals > 77) errors.push('Confirm COFFERS decimals');
  if (JSON.stringify(config.costsPerStepTokens) !== JSON.stringify(costs)) errors.push('Approved ascension costs differ');
  if (JSON.stringify(config.rewardWeightsScaled) !== JSON.stringify(weights)) errors.push('Approved rewards weights differ');
  if (typeof config.ascensionEnabled !== 'boolean') errors.push('Specify expected ascensionEnabled');
  try {
    const uri = new URL(config.ascendedBaseURI);
    if (!['https:', 'ipfs:'].includes(uri.protocol) || uri.hostname.endsWith('.invalid') || uri.hostname === 'localhost' || !config.ascendedBaseURI.endsWith('/')) throw new Error();
  } catch { errors.push('Set a real HTTPS/IPFS metadata base ending in /'); }
  return errors;
}

// Read-only. The caller supplies a trusted RPC; no keys, approvals or writes.
export async function verifyLive(config, rpc) {
  const provider = new ethers.JsonRpcProvider(rpc);
  try {
    if (Number((await provider.getNetwork()).chainId) !== config.chainId) throw new Error('RPC network differs from launch config');
    const blockTag = await provider.getBlockNumber();
    const at = {blockTag};
    for (const key of ['membership', 'coffers', 'rewards']) {
      if (await provider.getCode(config[key], blockTag) === '0x') throw new Error(`${key} has no deployed code`);
    }
    const nft = new ethers.Contract(config.membership, [
      'function owner() view returns(address)', 'function burnToken() view returns(address)',
      'function ascensionEnabled() view returns(bool)', 'function ascendedBaseURI() view returns(string)',
      'function ascendCost(uint256) view returns(uint256)', 'function maxSupply() view returns(uint256)'
    ], provider);
    const token = new ethers.Contract(config.coffers, ['function decimals() view returns(uint8)'], provider);
    const rewards = new ethers.Contract(config.rewards, [
      'function membership() view returns(address)', 'function owner() view returns(address)',
      'function pendingOwner() view returns(address)', 'function REVIEW_DELAY() view returns(uint256)',
      'function levelWeight(uint8) view returns(uint256)', 'function POINT_SCALE() view returns(uint256)',
      'function paused() view returns(bool)'
    ], provider);
    const errors = [];
    const equal = (actual, expected, label) => {
      if (String(actual).toLowerCase() !== String(expected).toLowerCase()) errors.push(`${label} differs`);
    };
    equal(await nft.owner(at), config.membershipOwner, 'Membership owner');
    equal(await nft.burnToken(at), config.coffers, 'COFFERS address');
    equal(await nft.ascensionEnabled(at), config.ascensionEnabled, 'Ascension switch');
    if (await nft.ascendedBaseURI(at) !== config.ascendedBaseURI) errors.push('Metadata base differs');
    equal(await nft.maxSupply(at), 4444, 'Membership supply cap');
    equal(await token.decimals(at), config.coffersDecimals, 'COFFERS decimals');
    for (let i = 0; i < costs.length; i++) equal(await nft.ascendCost(i + 1, at), ethers.parseUnits(costs[i], config.coffersDecimals), `Level ${i + 1} cost`);
    equal(await rewards.membership(at), config.membership, 'Rewards membership');
    equal(await rewards.owner(at), config.rewardsOwner, 'Rewards owner');
    equal(await rewards.pendingOwner(at), ethers.ZeroAddress, 'Pending rewards ownership transfer');
    equal(await rewards.REVIEW_DELAY(at), 86400, 'Rewards review delay');
    equal(await rewards.POINT_SCALE(at), 2, 'Rewards point scale');
    equal(await rewards.paused(at), false, 'Rewards pause');
    for (let i = 0; i < weights.length; i++) equal(await rewards.levelWeight(i, at), weights[i], `Level ${i} weight`);
    return {blockNumber: blockTag, errors};
  } finally { provider.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = JSON.parse(fs.readFileSync(process.argv[2] ?? 'config/mainnet-launch.json', 'utf8'));
    const errors = validateLaunch(config);
    let live = null;
    if (!errors.length && process.env.ARC_MAINNET_RPC) live = await verifyLive(config, process.env.ARC_MAINNET_RPC);
    errors.push(...(live?.errors ?? []));
    console.log(JSON.stringify({configurationValid: !errors.length, liveVerified: live !== null && !errors.length, blockNumber: live?.blockNumber ?? null, errors, scope: 'Configuration checks only; not an audit, bytecode verification or launch authorization.'}, null, 2));
    process.exitCode = errors.length || live === null ? 1 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
