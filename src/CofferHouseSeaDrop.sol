// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC721SeaDrop} from "seadrop/ERC721SeaDrop.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Test candidate. SeaDrop handles ALL minting; this extension handles ascension.
/// @dev N0..N5 retained from supplied Maia source pending final CofferHouse level mapping.
contract CofferHouseSeaDrop is ERC721SeaDrop {
    using SafeERC20 for IERC20;
    uint8 public constant MAX_TIER = 5;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    IERC20 public burnToken;
    bool public ascensionEnabled;
    mapping(uint256 => uint8) public tier;
    mapping(uint256 => uint256) public empoweredUntil;
    uint256[6] public ascendCost = [uint256(0), 20_000e18, 80_000e18, 320_000e18, 1_000_000e18, 2_000_000e18];
    string public ascendedBaseURI;
    uint256 private _ascensionLock;

    event Ascended(uint256 indexed tokenId, uint8 fromTier, uint8 toTier, bool bySacrifice);
    event Sacrificed(uint256 indexed survivorId, uint256[] ids);
    event Empowered(uint256 indexed tokenId, uint256 amount, uint256 until);
    event AscensionConfigured(address token, bool enabled);
    event AscendCostsUpdated(uint256[6] costs);
    event AscendedURIUpdated(string uri);

    modifier protectedAscension() {
        require(ascensionEnabled, "ascension disabled");
        require(_ascensionLock == 0, "reentrant ascension");
        _ascensionLock = 1;
        _;
        _ascensionLock = 0;
    }

    constructor(string memory name_, string memory symbol_, address[] memory seaDrops)
        ERC721SeaDrop(name_, symbol_, seaDrops) {
        require(seaDrops.length > 0, "no SeaDrop");
        for (uint256 i; i < seaDrops.length; ++i) {
            require(seaDrops[i].code.length > 0, "SeaDrop not contract");
        }
        _maxSupply = 4444;
    }

    function configureAscension(IERC20 token, bool enabled) external onlyOwner {
        require(!enabled || address(token).code.length > 0, "invalid token");
        require(!enabled || bytes(ascendedBaseURI).length > 0, "no ascended URI");
        burnToken = token;
        ascensionEnabled = enabled;
        emit AscensionConfigured(address(token), enabled);
    }

    function setAscendCosts(uint256[6] calldata costs) external onlyOwner {
        require(costs[0] == 0, "invalid base cost");
        for (uint256 i = 1; i <= MAX_TIER; ++i) require(costs[i] > 0, "zero cost");
        ascendCost = costs;
        emit AscendCostsUpdated(costs);
    }

    function setAscendedBaseURI(string calldata uri) external onlyOwner {
        require(bytes(uri).length > 0, "empty URI");
        ascendedBaseURI = uri; // Must end in /; serves <tier>/<tokenId>.json.
        emit AscendedURIUpdated(uri);
    }

    function activate(uint256 id) external protectedAscension {
        require(tier[id] == 0, "already active");
        _ascend(id);
    }

    function ascend(uint256 id) external protectedAscension {
        require(tier[id] >= 1, "activate first");
        _ascend(id);
    }

    function _ascend(uint256 id) internal {
        require(ownerOf(id) == msg.sender, "not owner");
        uint8 previous = tier[id];
        require(previous < MAX_TIER, "max tier");
        uint8 target = previous + 1;
        tier[id] = target;
        burnToken.safeTransferFrom(msg.sender, DEAD, ascendCost[target]);
        // A token callback must not transfer the membership during payment.
        require(ownerOf(id) == msg.sender, "owner changed");
        emit Ascended(id, previous, target, false);
        emit BatchMetadataUpdate(id, id);
    }

    /// @notice Maia rule: target N2 => 1 N1 OR 2 N0; N3 => 1 N2 OR 2 N1 OR 3 N0.
    /// Survivor must already be activated. All sacrificed NFTs share the same tier.
    function cannibalize(uint256 survivor, uint256[] calldata ids) external protectedAscension {
        require(ownerOf(survivor) == msg.sender, "not owner");
        uint8 previous = tier[survivor];
        require(previous >= 1 && previous < MAX_TIER, "bad tier");
        uint8 target = previous + 1;
        uint256 count = ids.length;
        require(count >= 1 && count <= target, "bad count");
        uint8 requiredTier = target - uint8(count);
        for (uint256 i; i < count; ++i) {
            uint256 id = ids[i];
            require(id != survivor, "self sacrifice");
            require(ownerOf(id) == msg.sender, "not sacrifice owner");
            require(tier[id] == requiredTier, "wrong sacrifice tier");
            delete tier[id];
            delete empoweredUntil[id];
            _burn(id); // Duplicate IDs revert atomically when ownerOf reads the burned ID.
        }
        tier[survivor] = target;
        emit Sacrificed(survivor, ids);
        emit Ascended(survivor, previous, target, true);
        emit BatchMetadataUpdate(survivor, survivor);
    }

    /// @dev Maia behavior retained: each positive offering adds 30 days. Pricing TBD.
    function empower(uint256 id, uint256 amount) external protectedAscension {
        require(ownerOf(id) == msg.sender, "not owner");
        require(tier[id] >= 1 && amount > 0, "bad empower");
        uint256 base = empoweredUntil[id] > block.timestamp ? empoweredUntil[id] : block.timestamp;
        empoweredUntil[id] = base + 30 days;
        burnToken.safeTransferFrom(msg.sender, DEAD, amount);
        require(ownerOf(id) == msg.sender, "owner changed");
        emit Empowered(id, amount, empoweredUntil[id]);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        require(_exists(id), "nonexistent token");
        if (tier[id] == 0) return super.tokenURI(id);
        return string.concat(ascendedBaseURI, _toString(tier[id]), "/", _toString(id), ".json");
    }
    /// @dev Hard lifetime cap even if inherited owner settings raise maxSupply.
    function _beforeTokenTransfers(address from, address to, uint256 start, uint256 quantity)
        internal override {
        if (from == address(0)) require(start + quantity <= 4445, "lifetime supply cap");
        super._beforeTokenTransfers(from, to, start, quantity);
    }

}
