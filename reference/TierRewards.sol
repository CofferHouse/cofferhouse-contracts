// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ⚠️ DRAFT — UNAUDITED. Arc testnet review only.

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof}     from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title  TierRewards — holder reward claims, weighted off-chain by NFT tier.
 * @notice The vault's/protocol's fee slice (in `rewardToken`, e.g. USDC on Arc)
 *         is sent here. An off-chain engine computes each holder's CUMULATIVE
 *         reward — weighted by NFT tier + empower + deposit — and publishes a
 *         merkle root per epoch. This is how a holder earns MORE than an external
 *         depositor: same vault yield for everyone, plus this tier-weighted slice
 *         on top for holders. Cumulative design => claim many epochs in one tx.
 *
 * @dev    Leaf = keccak256(abi.encodePacked(account, cumulativeAmount)).
 *         `rewardToken` is a parameter, so it can be USDC, the project token, or
 *         anything — nothing here hardcodes a token name.
 */
contract TierRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20  public immutable rewardToken;
    bytes32 public merkleRoot;
    uint256 public epoch;
    mapping(address => uint256) public claimed;

    event RootUpdated(uint256 indexed epoch, bytes32 root);
    event Claimed(address indexed account, uint256 amount, uint256 cumulative);

    constructor(IERC20 rewardToken_, address owner_) Ownable(owner_) {
        require(address(rewardToken_) != address(0), "token=0");
        rewardToken = rewardToken_;
    }

    function setRoot(bytes32 root) external onlyOwner {
        merkleRoot = root;
        epoch += 1;
        emit RootUpdated(epoch, root);
    }

    function claim(uint256 cumulative, bytes32[] calldata proof) external nonReentrant {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, cumulative));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "bad proof");
        uint256 already = claimed[msg.sender];
        require(cumulative > already, "nothing to claim");
        uint256 amount = cumulative - already;
        claimed[msg.sender] = cumulative;
        rewardToken.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount, cumulative);
    }

    function claimable(address account, uint256 cumulative) external view returns (uint256) {
        return cumulative > claimed[account] ? cumulative - claimed[account] : 0;
    }

    /// @notice Rescue tokens accidentally sent, or sweep leftover (owner = multisig).
    function sweep(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
