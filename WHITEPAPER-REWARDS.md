# Membership rewards

Only activated memberships participate in the rewards allocated to each distribution period. Ascending increases a membership's relative weight in that distribution.

| Membership level | Reward points |
|---|---:|
| Not activated | 0 — does not participate |
| Level 1 | 1 |
| Level 2 | 2 |
| Level 3 | 3.5 |
| Level 4 | 5 |
| Level 5 | 8 |

A wallet's points are the sum of the points of its activated memberships at the period's snapshot block. All memberships use the same table, including special artwork.

**Wallet participation (%) = wallet points ÷ total eligible points × 100.**

**Wallet reward = available reward pool × wallet participation ÷ 100.**

For example, a wallet with one Level 2 and one Level 3 membership has 5.5 points. If participants collectively have 550 points, that wallet's participation is 1%. A period with a 500 USDC reward pool would allocate 5 USDC to that wallet.

Points are relative distribution weights, not fixed percentages or a promised rate of return. Percentages change as the participating memberships and their levels change. Rewards are distributed only from funds actually allocated and available for the period.

The snapshot fixes the beneficiary wallet and membership level for that period. A later transfer or sacrifice affects future snapshots, not rewards already assigned. Unactivated and burned memberships at the snapshot do not participate. No additional empower multiplier is included in this approved table.

Holder Center is intended to show the wallet's eligible points, participation percentage for each period, reward asset and claimable amount. This interface has not yet been deployed.

## Implementation and publication

The contract represents half-points using integer units: 0, 2, 4, 7, 10 and 16, with POINT_SCALE = 2. This produces exactly the same proportions as the displayed table. ERC20 payments round down to the token's smallest unit.

The administrator prepares and publishes a historical ownership/level snapshot and its reward proofs. The distributor verifies those proofs and calculates payments onchain. It does not independently reconstruct historical levels or guarantee the accuracy of the administrator's snapshot. Every published period must be backed by funds, and its proofs remain claimable in later periods, subject to an administrative emergency pause.

Policy approved 12 October 2026. Contract implementation and local tests completed; deployment, external security review and integration into the published whitepaper/website are still pending.

---

# Texto para la versión en español

Solo las membresías activadas participan en el fondo de rewards disponible para cada periodo. Al ascender aumenta su peso en el reparto: nivel 1, 1 punto; nivel 2, 2 puntos; nivel 3, 3.5 puntos; nivel 4, 5 puntos; nivel 5, 8 puntos. Las membresías sin activar no participan.

Los puntos de una wallet se suman. Su participación porcentual se obtiene dividiendo sus puntos entre los puntos totales elegibles y multiplicando por 100. Por ejemplo, 5.5 puntos sobre un total de 550 representan el 1% del fondo. Si el fondo de ese periodo contiene 500 USDC, corresponden 5 USDC.

Los puntos no son porcentajes fijos ni tasas de rendimiento. La participación cambia según las membresías y niveles presentes en el registro de cada periodo. Solo se reparten fondos realmente disponibles y asignados a rewards.
