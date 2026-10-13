# Holder Center ↔ Agent Suite

## User flow

Holder Center is the memberships, ascension and rewards area of the CofferHouse site. Agent Suite remains a separate tool accessible from that area; both use the same connected wallet and network.

1. View membership levels and reward participation.
2. Claim a funded reward epoch to the beneficiary wallet.
3. Click **Use in Agent Suite** and choose an amount of the now-confirmed available balance.
4. Review the selected strategy, target, permissions and transaction in Agent Suite.
5. Explicitly authorize execution once Agent Suite has its real execution integration.

No additional deposit is required when spendable rewards are already in the same wallet. There is no dedicated custodial agent wallet in the current Suite. Unclaimed amounts cannot be presented as spendable balance. A preference such as DCA is not transaction authorization.

USDC/native balance on Arc is one balance with different display units, not two assets. Reserve sufficient native USDC for gas. COFFERS or other reward assets require an explicit fresh conversion review when the target accepts only USDC. Do not silently swap or bridge.

## Existing integration boundary

Reviewed `CofferHouse/cofferhouse-agent-suite`:
- `packages/agent-modules/holder-center.js` already provides local reward-destination preferences.
- `packages/agent-modules/action-center.js` is read-only action preparation and says it does not build calldata or execute.
- `packages/agent-modules/automation.js` models permission checks; it has no installed wallet permissions.

Connecting financial execution is therefore future implementation, not an existing capability. The contracts repository does not replace that application's UI or turn its previews into executable strategies. Its current Member/Builder/Steward/Partner/Keyholder catalog has five entries and is not yet mapped to the six onchain N0..N5 states. Resolve that mapping during frontend integration; do not infer levels from token balance thresholds.

## Handoff contract for frontend integration

Data passed between areas should identify chainId, connected beneficiary wallet, ERC20 token address, token decimals, selected amount in smallest units, confirmed claim transaction and reward epoch. The receiving tool re-reads balance and transaction receipt, obtains a fresh strategy simulation and rejects mismatched chain/wallet/token. URL fields and browser-local preferences are hints, never authorization or proof of funding.

Keep contracts separate: existing NFT+ascension and rewards distributor. No additional forwarding contract is required for the initial same-wallet flow. Atomic claim-and-operate and delegated smart-account execution require separate implementation and review; they are not included here.

Status: integration design documented. The published Agent Suite and main site have not been modified by this delivery.
