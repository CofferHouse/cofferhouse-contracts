import assert from 'node:assert/strict';
import {ethers} from 'ethers';
import {makeManifest, LEVEL_WEIGHTS} from '../scripts/rewards.mjs';
import {verifyManifest} from '../scripts/verify-rewards.mjs';
const addr = n => ethers.getAddress('0x' + String(n).padStart(40, '0'));
const input = {
  domain: {chainId: '5042', epoch: '1', distributor: addr(1), membership: addr(2), token: addr(3)},
  snapshot: {chainId: '5042', membership: addr(2), blockNumber: 100, blockHash: '0x' + 'ab'.repeat(32), memberships: [
    {id: 1, owner: addr(4), level: 1}, {id: 2, owner: addr(5), level: 3},
    {id: 3, owner: addr(6), level: 0}, {id: 4, owner: addr(7), level: 2}
  ]}, weights: LEVEL_WEIGHTS, budget: '1000000'
};
const manifest = makeManifest(input.domain, input.snapshot, input.weights, input.budget);
const bytes = JSON.stringify(manifest, null, 2) + '\n';
const report = verifyManifest(input, bytes);
assert.equal(report.beneficiaries, 3);
assert.equal(report.totalPoints, '13');
assert.equal(report.manifestHash, ethers.keccak256(ethers.toUtf8Bytes(bytes)));
const compact = verifyManifest(input, JSON.stringify(manifest));
assert.notEqual(compact.manifestHash, report.manifestHash, 'Whitespace changes the exact published hash');
let checks = 4;
for (const mutate of [
  m => m.claims.pop(), m => m.claims.push(m.claims[0]),
  m => m.claims[0].points = '999', m => m.claims[0].amount = '1',
  m => m.claims[0].proof = [], m => m.domain.epoch = '2',
  m => m.domain.token = addr(9), m => m.snapshotBlockHash = ethers.ZeroHash,
  m => m.totalPoints = '14', m => m.root = ethers.ZeroHash,
  m => m.unallocatedRounding = '0', m => m.weights[3] = '8',
  m => m.claims[0].account = addr(6), m => m.pointScale = 1
]) {
  const changed = structuredClone(manifest); mutate(changed);
  assert.throws(() => verifyManifest(input, JSON.stringify(changed))); checks++;
}
assert.throws(() => verifyManifest({...input, budget: 1000000}, bytes)); checks++;
assert.throws(() => verifyManifest({...input, domain: {...input.domain, epoch: '0'}}, bytes)); checks++;
assert.throws(() => verifyManifest({...input, snapshot: {...input.snapshot, blockNumber: -1}}, bytes)); checks++;
console.log(`Rewards publication: ${checks} checks passed`);
