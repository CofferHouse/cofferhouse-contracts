# Mainnet launch preparation — October 14, 2026

This document supplements the October 12 status. It does not authorize transactions.
The user plans to operate after token launch and commission an external audit
after financing. Local and testnet validation do not establish production safety.

## Preserve the existing collection

The existing Arc mainnet collection is
`0xBdAAD4B289b65B572E231e548278B9451A13f0FE` on chain 5042.
Its source already includes activation, paid ascension and sacrifice. Do not mint
into a replacement collection or redeploy it for these features. Previous runtime
identity evidence came from user-supplied bytecode; independent live verification
and explorer source verification are still required. The source is unchanged here.

Approved step costs remain 20,000 / 80,000 / 320,000 / 1,000,000 / 2,000,000
COFFERS. Configuration uses the actual token decimals, not an assumption of 18.
Approved reward weights remain 0 / 2 / 4 / 7 / 10 / 16 internal points.

## Empower removal candidate — latest user decision

The user requested removal of the underpriced empower mechanism before launch.
`candidates/CofferHouseSeaDrop.sol` removes the function, timer storage, timer
cleanup and event entirely. `src/CofferHouseSeaDrop.sol` is preserved as the
historical source of the existing collection. The candidate cannot patch an
already deployed collection. Its inheritance exposes no upgrade entry point.
A new deployment and a decision about the existing collection/mint are required
before using this candidate. No collection is replaced by this PR.

Run `node test/no-empower.mjs` for the candidate's full SeaDrop integration suite.
It also submits the old empower selector directly from owner and non-owner,
with zero, minimum and larger amounts, to ensure it reverts even when ascension
is enabled. The launch config/verifier below still targets the existing collection
and must not be interpreted as approval to activate it after this new decision.

### Existing deployment limitation

Enabling ascension also exposes `empower`. There is no separate switch. Any
positive amount sent to DEAD adds 30 days to an active membership's
`empoweredUntil`; repeated calls accumulate time. It does not change the level.
Current rewards and snapshots do not use this value. Do not grant access, reward
boosts, discounts or other benefits based on this state without a separately
approved policy and implementation. Removing a web button cannot prevent direct
contract calls. This limitation must be included in the later audit scope.

## Testnet evidence

Arc Testnet memberships #2 and #3 were sacrificed to raise #4 to level 2;
payment of 320,000 TESTCOFFERS raised #4 to level 3. Rewards period 1 was
published with 1,000 TESTCOFFERS, 11 internal points and a 24-hour review delay.
The real testnet claim remains pending until October 14, 19:08:43 Mexico City.
Holder Center testnet integration was merged in Agent Suite PR #1. This does not
enable mainnet actions. UI wallet end-to-end testing remains pending.

## Reproducible configuration check

Fill `config/mainnet-launch.json` with confirmed addresses and metadata.
Unknown production values are intentionally null. Do not copy testnet addresses.

```sh
node test/launch.mjs
node scripts/verify-launch.mjs config/mainnet-launch.json
ARC_MAINNET_RPC=<trusted-rpc-url> node scripts/verify-launch.mjs config/mainnet-launch.json
```

The verifier is read-only and never signs. It fails closed on missing settings,
wrong chain, known testnet addresses, altered approved costs/weights, or placeholder
metadata. When fully configured, it checks deployed code presence, collection and
rewards bindings, owners, token decimals, metadata base, costs, pause state and
immutable weights at one block. It does not establish bytecode identity, metadata
file availability, token economic behavior, mint closure, source verification,
fee funding or security. A matching configuration is not launch authorization.

Use `ascensionEnabled:false` to check configuration before activation; changing
the expected value to true only checks an already enabled contract. It cannot
enable the contract. Set rewardsOwner to the final administrator after any
two-step ownership transfer is accepted.

## Remaining production inputs and actions

- Confirm the real COFFERS address and decimals; check standard token behavior.
- Publish actual level metadata and verify individual token routes.
- Confirm final administrators, fee source and reward publication cadence.
- Deploy and verify the rewards distributor bound to the existing collection.
- Confirm independent mainnet collection identity and mint configuration.
- Complete the pending claim rehearsal and UI wallet flows.
- Configure costs/token/URI and activate through explicitly reviewed wallet calls.
- Fund only actual received fees; publish reviewed, durably hosted manifests.

Rewards become claimable 24 hours after each funded epoch is published, not
automatically at token launch. Incorrect immutable roots cannot be replaced.
No private keys or deployment transactions are part of this preparation.
