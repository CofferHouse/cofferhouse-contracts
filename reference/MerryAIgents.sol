// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ⚠️ DRAFT — UNAUDITED. Testnet review only. Do NOT deploy to mainnet with real
// funds before a professional audit. — Merry AIgents

import {ERC721}      from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20}      from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable}     from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Strings}     from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title  MerryAIgents — 4,444 dynamic archer-automaton NFTs.
 * @notice Each NFT mints DORMANT (tier 0). Holders burn $MAiA to ACTIVATE and ASCEND,
 *         or sacrifice companion AIgents (CANNIBALISM) to ascend without token.
 *         The tier lives on-chain; tokenURI serves the matching art/metadata
 *         (dormant art is permanent on Arweave; ascended art comes from a dynamic
 *         metadata service set later).
 *
 * @dev    ERC-6551 token-bound accounts are created off-contract via the canonical
 *         6551 Registry — this contract only needs to be a standard ERC-721 for that.
 */
contract MerryAIgents is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ─────────────────────────────────────────────────────────── constants
    uint256 public constant MAX_SUPPLY = 4444;
    uint256 public constant MAX_TIER   = 5;            // N0..N5
    address public constant DEAD       = 0x000000000000000000000000000000000000dEaD;

    // Ascension cost to REACH a tier, in $MAiA (18 decimals). Index = target tier.
    // [ -, N1(activate), N2, N3, N4, N5 ]
    uint256[6] public ascendCost = [
        uint256(0),
        20_000  ether,   // N0 -> N1  (activate)
        80_000  ether,   // N1 -> N2
        320_000 ether,   // N2 -> N3
        1_000_000 ether, // N3 -> N4
        2_000_000 ether  // N4 -> N5
    ];

    // ───────────────────────────────────────────────────────────── storage
    IERC20  public maia;                 // the $MAiA token (set after PONS launch)
    uint256 public totalMinted;
    mapping(uint256 => uint8) public tier;          // tokenId => current tier (0..5)
    mapping(uint256 => uint64) public empoweredUntil; // tokenId => empower expiry (unix)

    // metadata
    string public dormantBaseURI;        // e.g. "https://arweave.net/<manifest>/"  (N0 art, permanent)
    string public dynamicBaseURI;        // e.g. "https://meta.merryaigents.xyz/"    (ascended art, set later)

    // mint config
    uint256 public wlPrice     = 0.003333 ether;
    uint256 public publicPrice = 0.004444 ether;
    uint256 public wlWalletCap = 4;
    bytes32 public wlMerkleRoot;
    bool    public wlOpen;
    bool    public publicOpen;
    mapping(address => uint256) public wlMinted;

    // ─────────────────────────────────────────────────────────────── events
    event Activated(uint256 indexed tokenId, address indexed owner);
    event Ascended(uint256 indexed tokenId, uint8 fromTier, uint8 toTier, bool byCannibalism);
    event Cannibalized(uint256 indexed survivorId, uint256[] sacrificed);
    event Empowered(uint256 indexed tokenId, uint256 amountBurned, uint64 until);

    constructor(string memory dormantURI_)
        ERC721("Merry AIgents", "MAIA")
        Ownable(msg.sender)
    {
        dormantBaseURI = dormantURI_;
    }

    // ═══════════════════════════════════════════════════════════════ MINT
    // NOTE: self-contained WL (merkle) + public mint. If you instead launch via
    // OpenSea SeaDrop, replace this section with the ERC721SeaDrop base and keep
    // everything below (ascension) unchanged.

    function whitelistMint(uint256 qty, bytes32[] calldata proof) external payable nonReentrant {
        require(wlOpen, "wl closed");
        require(totalMinted + qty <= MAX_SUPPLY, "sold out");
        require(wlMinted[msg.sender] + qty <= wlWalletCap, "wl cap");
        require(MerkleProof.verify(proof, wlMerkleRoot, keccak256(abi.encodePacked(msg.sender))), "not wl");
        require(msg.value == wlPrice * qty, "bad value");
        wlMinted[msg.sender] += qty;
        _mintMany(msg.sender, qty);
    }

    function publicMint(uint256 qty) external payable nonReentrant {
        require(publicOpen, "public closed");
        require(totalMinted + qty <= MAX_SUPPLY, "sold out");
        require(msg.value == publicPrice * qty, "bad value");
        _mintMany(msg.sender, qty);
    }

    function _mintMany(address to, uint256 qty) internal {
        require(qty > 0, "qty=0");
        uint256 id = totalMinted;
        for (uint256 i; i < qty; ++i) {
            id += 1;                 // token ids 1..4444
            _safeMint(to, id);       // tier defaults to 0 (dormant)
        }
        totalMinted = id;
    }

    // ═══════════════════════════════════════════════════════════ ASCENSION

    /// @notice Wake a dormant AIgent: burn 20,000 $MAiA, N0 -> N1.
    function activate(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(tier[tokenId] == 0, "already awake");
        _burnMaia(msg.sender, ascendCost[1]);
        tier[tokenId] = 1;
        emit Activated(tokenId, msg.sender);
        emit Ascended(tokenId, 0, 1, false);
    }

    /// @notice Ascend one tier by BURNING $MAiA (the token path).
    function ascend(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        uint8 t = tier[tokenId];
        require(t >= 1 && t < MAX_TIER, "bad tier");
        _burnMaia(msg.sender, ascendCost[t + 1]);
        tier[tokenId] = t + 1;
        emit Ascended(tokenId, t, t + 1, false);
    }

    /// @notice Ascend one tier by CANNIBALISM: sacrifice `j` AIgents, each of tier
    ///         (targetTier - j). No $MAiA is burned; the sacrifices are burned forever.
    ///         Matches the table exactly:
    ///           -> N2: 1×N1 or 2×N0
    ///           -> N3: 1×N2 or 2×N1 or 3×N0
    ///           -> N4: 1×N3 or 2×N2 or 3×N1 or 4×N0
    ///           -> N5: 1×N4 or 2×N3 or 3×N2 or 4×N1 or 5×N0
    function cannibalize(uint256 survivorId, uint256[] calldata sacrificeIds) external nonReentrant {
        require(ownerOf(survivorId) == msg.sender, "not owner");
        uint8 target = tier[survivorId] + 1;
        require(target >= 2 && target <= MAX_TIER, "bad tier");
        uint256 j = sacrificeIds.length;
        require(j >= 1 && j <= target, "bad count");         // j in 1..target
        uint8 requiredTier = uint8(target - j);              // each sacrifice must be this tier
        for (uint256 i; i < j; ++i) {
            uint256 sid = sacrificeIds[i];
            require(sid != survivorId, "self-sacrifice");
            require(ownerOf(sid) == msg.sender, "not owner of sacrifice");
            require(tier[sid] == requiredTier, "wrong sacrifice tier");
            delete tier[sid];
            _burn(sid);                                      // sacrifice burned forever
        }
        tier[survivorId] = target;
        emit Cannibalized(survivorId, sacrificeIds);
        emit Ascended(survivorId, target - 1, target, true);
    }

    /// @notice Empower: burn $MAiA as an offering to the Major Oak for a 30-day boost.
    ///         The off-chain rewards engine reads `empoweredUntil` to raise your share.
    function empower(uint256 tokenId, uint256 amount) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(tier[tokenId] >= 1, "activate first");
        require(amount > 0, "amount=0");
        _burnMaia(msg.sender, amount);
        uint64 base = empoweredUntil[tokenId] > block.timestamp
            ? empoweredUntil[tokenId] : uint64(block.timestamp);
        empoweredUntil[tokenId] = base + 30 days;            // stacks / renews
        emit Empowered(tokenId, amount, empoweredUntil[tokenId]);
    }

    /// @dev Pull $MAiA from the holder and send it to the burn address. Works with any
    ///      ERC-20 (no burn() needed on the token). Holder must approve() this contract.
    function _burnMaia(address from, uint256 amount) internal {
        require(address(maia) != address(0), "maia unset");
        require(maia.transferFrom(from, DEAD, amount), "maia transfer failed");
    }

    // ═══════════════════════════════════════════════════════════ METADATA

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        // Dormant (tier 0) → permanent Arweave art. Ascended → dynamic service (if set).
        if (tier[tokenId] == 0 || bytes(dynamicBaseURI).length == 0) {
            return string.concat(dormantBaseURI, tokenId.toString(), ".json");
        }
        return string.concat(dynamicBaseURI, tokenId.toString(), ".json");
    }

    // ═══════════════════════════════════════════════════════════ ADMIN

    function setMaia(address token) external onlyOwner { maia = IERC20(token); }
    function setDynamicBaseURI(string calldata uri) external onlyOwner { dynamicBaseURI = uri; }
    function setDormantBaseURI(string calldata uri) external onlyOwner { dormantBaseURI = uri; }
    function setAscendCost(uint256[6] calldata costs) external onlyOwner { ascendCost = costs; }
    function setSale(bool wl, bool pub) external onlyOwner { wlOpen = wl; publicOpen = pub; }
    function setWlRoot(bytes32 root) external onlyOwner { wlMerkleRoot = root; }
    function setPrices(uint256 wl_, uint256 pub_) external onlyOwner { wlPrice = wl_; publicPrice = pub_; }
    function ownerMint(address to, uint256 qty) external onlyOwner {
        require(totalMinted + qty <= MAX_SUPPLY, "sold out");
        _mintMany(to, qty);
    }
    function withdraw(address payable to) external onlyOwner {
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok, "withdraw failed");
    }
}
