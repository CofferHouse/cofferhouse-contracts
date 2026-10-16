import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLaunch} from '../scripts/verify-launch.mjs';
const template = JSON.parse(fs.readFileSync('config/mainnet-launch.json', 'utf8'));
assert.ok(validateLaunch(template).length > 0, 'Incomplete template must block launch');
const config = {...template, coffers: '0x0000000000000000000000000000000000000001', rewards: '0x0000000000000000000000000000000000000002', membershipOwner: '0x0000000000000000000000000000000000000003', rewardsOwner: '0x0000000000000000000000000000000000000004', coffersDecimals: 18, ascendedBaseURI: 'ipfs://bafyExample/'};
assert.deepEqual(validateLaunch(config), []);
for (const patch of [
  {chainId: 5042002}, {coffersDecimals: null}, {coffersDecimals: 78},
  {coffers: '0xd554aa76030dc7f18db5c6fe1d798c89a1d596bf'},
  {membership: '0x9f439d557355674f22e8f2a8babbf22a1122f24a'},
  {ascendedBaseURI: 'https://example.invalid/3/'},
  {ascendedBaseURI: 'https://example.com/metadata'},
  {costsPerStepTokens: ['1','2','3','4','5']}, {rewardWeightsScaled: [0,1,2,3,4,5]}
]) assert.ok(validateLaunch({...config, ...patch}).length > 0);
console.log('Launch configuration: 11 checks passed');
