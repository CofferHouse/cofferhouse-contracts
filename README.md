# CofferHouse Contracts

Memberships, ascension and rewards on Arc. Independent from Agent Suite.

## Current status

- ERC721 collection with SeaDrop and ascension: deployed at `0xBdAAD4B289b65B572E231e548278B9451A13f0FE`. Identity checked against user-supplied runtime bytecode; source verification in the explorer remains pending.
- Ascension: Merry AIgents costs and sacrifice rules retained. Not activated for production.
- Rewards distributor: implemented, locally tested and deployed on Arc Testnet at `0x91c838c6c2f1d63900c3cbeb980b2012b747f9f4`; no production deployment or external audit is established here.
- Approved reward points: inactive 0, levels 1–5: **1 / 2 / 3.5 / 5 / 8**. Onchain units **0 / 2 / 4 / 7 / 10 / 16**, scale 2.
- Holder Center testnet integration and period catalog are deployed in Agent Suite. Production activation remains separate.

## Develop and test

```sh
npm ci --ignore-scripts --omit=optional
npm test
node scripts/build-rewards.mjs
```

Solidity dependencies are vendored. Compiler 0.8.17, optimizer 200, EVM London. See `DEPENDENCIES.md` for pinned revisions. Node 22 is used in CI.

## Files

- `src/CofferHouseSeaDrop.sol`: deployed collection source; do not redeploy this NFT.
- `src/CofferHouseRewards.sol`: funded epoch distributor; each payment is calculated onchain from proven snapshot points.
- `scripts/rewards-snapshot.mjs`: historical ownership and level snapshot.
- `scripts/rewards.mjs`: allocation manifest and proofs using the approved points table.
- `wallet/holder-actions.mjs`: wallet action adapters.
- `test/`: ascension, metadata and reward tests.
- `WHITEPAPER-REWARDS.md`: English and Spanish copy ready for whitepaper integration; not yet published on the website.
- `CONTRACTS-STATUS-2026-10-12.md`: operating instructions and remaining activation work.
- `HISTORY-2026-10-09.md`: historical implementation notes; superseded by current status.

## Reward calculation

Only activated memberships participate. Wallet participation = wallet points / total eligible points. Rewards = available epoch budget × participation, rounded down in ERC20 smallest units. Points are relative weights, not fixed percentages or an APY.

The publisher is trusted to supply accurate snapshots and total points. The contract verifies proofs and computes payments but cannot reconstruct historical NFT state. Existing funded epochs have immutable roots and no claim expiry; administrative pause is available. Reserved rewards cannot be swept.

Mainnet activation requires approved token addresses/decimals, hosting, testnet wallet rehearsals and external security review. No deployment keys or private reveal mappings belong in this repository.

## Arc testnet rehearsal

`rehearsal/` provides a wallet-signed rehearsal on Arc Testnet using a new copy of the NFT, a test-only mint relay and TESTCOFFERS, and the rewards distributor. It leaves the production collection untouched. See `rehearsal/README.md` for network and faucet setup. The 24-hour reward review period is retained. The testnet rehearsal has been run. See [October 18 evidence update](docs/REHEARSAL-STATUS-2026-10-18.md) for the owner-confirmed test status and the independent epoch-state discrepancy.

`docs/HOLDER-AGENT-INTEGRATION.md` documents the same-wallet reward-to-strategy path. The testnet membership UI is deployed; delegated financial execution by agents remains unimplemented/gated.

## Latest evidence

[October 18 rehearsal status](docs/REHEARSAL-STATUS-2026-10-18.md) supersedes stale pending-test statements in historical notes. Preserve the existing mainnet collection; no replacement or activation is performed by this update.
