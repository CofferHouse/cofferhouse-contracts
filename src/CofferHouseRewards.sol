// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "openzeppelin-contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/security/ReentrancyGuard.sol";
import {Math} from "openzeppelin-contracts/utils/math/Math.sol";

/// @notice Funded, immutable reward epochs. Entitlements belong to snapshot wallets.
/// @dev Publisher is trusted for allocation accuracy. Only standard non-rebasing,
/// non-fee-on-transfer ERC20s are supported. No native-USDC rewards in this module.
contract CofferHouseRewards is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public owner;
    address public pendingOwner;
    address public immutable membership;
    uint256 public constant REVIEW_DELAY = 1 days;
    uint256 public nextEpoch = 1;
    bool public paused;
    struct Epoch {
        address token;
        bytes32 root;
        bytes32 manifestHash;
        uint256 snapshotBlock;
        uint256 budget;
        uint256 paid;
        uint256 availableAt;
        uint256 totalPoints;
        uint256 claimedPoints;
    }
    mapping(uint256 => Epoch) public epochs;
    mapping(address => uint256) public reserved;
    mapping(uint256 => mapping(address => bool)) public claimed;
    event EpochPublished(uint256 indexed epoch, address indexed token, bytes32 root,
        uint256 budget, uint256 snapshotBlock, bytes32 manifestHash, uint256 availableAt);
    event Claimed(uint256 indexed epoch, address indexed account, uint256 amount);
    event Paused(bool status);
    event OwnershipProposed(address indexed nextOwner);
    event OwnershipAccepted(address indexed newOwner);
    event SurplusRecovered(address indexed token, address indexed to, uint256 amount);
    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    /// @notice Approved weights: 0 / 1 / 2 / 3.5 / 5 / 8, scaled by 2.
    /// No administrator can change this table after deployment.
    uint256 public constant POINT_SCALE = 2;
    function levelWeight(uint8 level) public pure returns (uint256) {
        require(level <= 5, "invalid level");
        uint256[6] memory weights = [uint256(0), 2, 4, 7, 10, 16];
        return weights[level];
    }
    /// @notice Exact integer allocation, rounded down in reward-token units.
    /// This is a calculation helper; publication still requires a reviewed snapshot.
    function allocation(uint256 budget, uint256 beneficiaryPoints, uint256 totalPoints)
        external pure returns (uint256) {
        require(totalPoints > 0 && beneficiaryPoints <= totalPoints, "invalid points");
        return Math.mulDiv(budget, beneficiaryPoints, totalPoints);
    }
    constructor(address membership_, address owner_) {
        require(membership_.code.length > 0 && owner_ != address(0), "invalid setup");
        membership = membership_;
        owner = owner_;
    }
    function proposeOwner(address next) external onlyOwner {
        require(next != address(0), "zero owner"); pendingOwner = next;
        emit OwnershipProposed(next);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending owner");
        owner = msg.sender; pendingOwner = address(0); emit OwnershipAccepted(msg.sender);
    }
    function setPaused(bool status) external onlyOwner { paused = status; emit Paused(status); }
    /// @notice Must pre-fund the contract; existing unpaid epochs stay fully reserved.
    function publishEpoch(address token, bytes32 root, uint256 budget,
        uint256 snapshotBlock, bytes32 manifestHash, uint256 totalPoints) external onlyOwner nonReentrant returns (uint256 id) {
        require(!paused, "paused");
        require(token.code.length > 0 && root != bytes32(0) && budget > 0
            && manifestHash != bytes32(0) && totalPoints > 0 && budget >= totalPoints, "invalid epoch");
        require(snapshotBlock < block.number, "snapshot not past");
        require(IERC20(token).balanceOf(address(this)) >= reserved[token] + budget, "unfunded");
        id = nextEpoch++;
        uint256 availableAt = block.timestamp + REVIEW_DELAY;
        epochs[id] = Epoch(token, root, manifestHash, snapshotBlock, budget, 0, availableAt, totalPoints, 0);
        reserved[token] += budget;
        emit EpochPublished(id, token, root, budget, snapshotBlock, manifestHash, availableAt);
    }
    function leaf(uint256 id, address account, uint256 points) public view returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(
            block.chainid, address(this), membership, id, epochs[id].token, account, points))));
    }
    /// @notice Anyone can submit a proof; payment ALWAYS goes to its beneficiary.
    function claim(uint256 id, address account, uint256 points, bytes32[] calldata proof)
        external nonReentrant {
        require(!paused, "paused");
        Epoch storage e = epochs[id];
        require(e.root != bytes32(0) && block.timestamp >= e.availableAt, "not available");
        require(account != address(0) && points > 0 && !claimed[id][account], "invalid claim");
        require(MerkleProof.verify(proof, e.root, leaf(id, account, points)), "bad proof");
        require(e.claimedPoints + points <= e.totalPoints, "points exceeded");
        uint256 amount = Math.mulDiv(e.budget, points, e.totalPoints);
        require(amount > 0 && e.paid + amount <= e.budget, "budget exceeded");
        e.claimedPoints += points;
        claimed[id][account] = true; e.paid += amount; reserved[e.token] -= amount;
        IERC20 token = IERC20(e.token);
        uint256 beforeBalance = token.balanceOf(account);
        uint256 beforeContract = token.balanceOf(address(this));
        token.safeTransfer(account, amount);
        require(token.balanceOf(account) == beforeBalance + amount
            && token.balanceOf(address(this)) + amount == beforeContract, "unsupported token");
        if (e.claimedPoints == e.totalPoints) reserved[e.token] -= e.budget - e.paid;
        emit Claimed(id, account, amount);
    }
    /// @notice Reserved rewards cannot be swept, even while paused.
    function recoverSurplus(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0) && amount <= token.balanceOf(address(this)) - reserved[address(token)], "reserved funds");
        token.safeTransfer(to, amount);
        require(token.balanceOf(address(this)) >= reserved[address(token)], "reserve impaired");
        emit SurplusRecovered(address(token), to, amount);
    }
}
