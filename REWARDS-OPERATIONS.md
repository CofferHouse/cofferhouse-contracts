# Reward publication workflow

This workflow can be prepared before mint closure and before choosing the COFFERS
launchpad. The existing membership collection is retained. Rewards support
standard ERC20 tokens; their smallest units and address are verified per token.
Native USDC, rebasing and fee-on-transfer reward assets are not supported.

## Funding source versus distribution

The launchpad or fee collector supplies funds. CofferHouseRewards distributes a
funded budget according to reviewed membership snapshots. These are separate
responsibilities. No fees are generated or collected automatically by the rewards
contract. Launchpad selection must establish:

- who receives fees and whether that recipient can be our treasury/distributor;
- the actual payout asset and decimals;
- how and when funds become withdrawable;
- whether transfers are automatic or require an administrator transaction;
- whether any platform adapter or separate router is necessary.

If direct forwarding is unavailable, treasury can fund the distributor with a
standard ERC20 transfer. Do not assume every launchpad permits arbitrary recipients
or onchain hooks. Frequency and source are still undecided; no APY is promised.

## Before publishing a period

1. Select a past block and create the snapshot with `scripts/rewards-snapshot.mjs`.
2. Review the snapshot, intended chain/collection/distributor/token/epoch and funded
   budget. Store the input used by `scripts/rewards.mjs` independently of the output.
3. Generate the manifest with `scripts/rewards.mjs`. Publish those exact bytes to
   durable hosting; retain the reviewed input and snapshot.
4. Check the manifest locally:

   ```sh
   node scripts/verify-rewards.mjs reviewed-input.json manifest.json
   ```

5. After funding, check historical completeness and publication conditions:

   ```sh
   REWARDS_RPC=<trusted-network-rpc> node scripts/verify-rewards.mjs reviewed-input.json manifest.json
   ```

6. Review the printed publisher, chain/domain, amounts and `publishArgs` before
   signing `publishEpoch` from the administrator wallet. Recheck if chain state
   changes; the read-only checker cannot lock state or submit a transaction.
7. Allow the contract's 24-hour review period. Claim payments always go to the
   snapshot beneficiary; a claim needs no ERC20 approval.

The checker rebuilds the complete manifest from the reviewed input, including
proofs, points, amounts, rounding and metadata. Hashing uses the exact file bytes.
Its optional RPC pass enumerates the historical minted IDs, skips only the known
ERC721A nonexistent-owner selector, and checks every surviving owner's level.
Inactive memberships must be present even though they receive no allocation.
It checks the snapshot block hash, distributor binding, next epoch, pause state,
approved weights and funds after subtracting existing reserves. Other RPC errors
abort the check. Historical reads require an archive-capable provider.

This is verification support, not an audit or proof of token economic behavior.
The local check alone cannot establish onchain provenance. The administrator's
snapshot/block selection and fee-allocation policy remain trusted decisions.
Immutable roots cannot be replaced or cancelled; do not sign a failed check.

## Current rehearsal and UI scope

Period 1 on Arc Testnet is already published. Its real wallet claim remains pending
until October 14, 2026, 19:08:43 Mexico City. The Holder Center currently supports
that rehearsal period only. A production manifest catalog and wallet UI rehearsal
must be completed before launching production claims. Do not republish period 1
merely to exercise these pre-publication checks.

`empoweredUntil` does not affect any reward points or allocation. The rules remain
inactive 0 and levels 1–5: 1 / 2 / 3.5 / 5 / 8 displayed weight (internal scale 2).
