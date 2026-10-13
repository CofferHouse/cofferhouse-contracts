// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ⚠️ DRAFT — UNAUDITED. Arc testnet review only.

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  TreasuryRouter — splits protocol income (in USDC) three ways.
 * @notice Receives the fee slice harvested from the Morpho Vault V2 (performance
 *         fee → this contract as feeRecipient). `distribute()` splits the balance:
 *           - rewards  -> TierRewards (holders, weighted by NFT tier)
 *           - buyback  -> a buyback executor (buys the project token & burns it)
 *           - maint    -> maintenance wallet (infra/ops)
 *         All destinations and bps are settable. On-chain buyback via a DEX
 *         (Uniswap on Arc) is a later add; for now the buyback slice is sent to a
 *         configurable executor address that performs the buy-and-burn.
 *
 * @dev    `feeToken` is USDC (6 decimals on Arc) — amounts are the token's own
 *         units, nothing here assumes 18 decimals.
 */
contract TreasuryRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;

    IERC20  public feeToken;         // USDC
    address public rewards;          // TierRewards
    address public buybackExecutor;  // buys project token & burns
    address public maintenance;      // ops wallet

    uint16 public rewardsBps = 7_000;   // 70%
    uint16 public buybackBps = 2_500;   // 25%
    uint16 public maintBps   =   500;   // 5%

    event Distributed(uint256 toRewards, uint256 toBuyback, uint256 toMaint);
    event SplitsUpdated(uint16 rewards, uint16 buyback, uint16 maint);

    constructor(IERC20 feeToken_, address owner_) Ownable(owner_) {
        require(address(feeToken_) != address(0), "token=0");
        feeToken = feeToken_;
    }

    function setDestinations(address rewards_, address buyback_, address maint_) external onlyOwner {
        require(rewards_ != address(0) && buyback_ != address(0) && maint_ != address(0), "0");
        rewards = rewards_; buybackExecutor = buyback_; maintenance = maint_;
    }

    function setSplits(uint16 rewardsBps_, uint16 buybackBps_, uint16 maintBps_) external onlyOwner {
        require(uint256(rewardsBps_) + buybackBps_ + maintBps_ == BPS, "must sum to 10000");
        rewardsBps = rewardsBps_; buybackBps = buybackBps_; maintBps = maintBps_;
        emit SplitsUpdated(rewardsBps_, buybackBps_, maintBps_);
    }

    /// @notice Split the whole current balance to the three destinations.
    function distribute() external nonReentrant {
        require(rewards != address(0), "destinations unset");
        uint256 bal = feeToken.balanceOf(address(this));
        require(bal > 0, "nothing");
        uint256 r = bal * rewardsBps / BPS;
        uint256 b = bal * buybackBps / BPS;
        uint256 m = bal - r - b; // remainder to maintenance (no dust lost)
        if (r > 0) feeToken.safeTransfer(rewards, r);
        if (b > 0) feeToken.safeTransfer(buybackExecutor, b);
        if (m > 0) feeToken.safeTransfer(maintenance, m);
        emit Distributed(r, b, m);
    }

    function setFeeToken(IERC20 t) external onlyOwner { require(address(t) != address(0), "0"); feeToken = t; }
}
