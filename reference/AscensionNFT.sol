// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ⚠️ DRAFT — UNAUDITED. For Arc testnet review only.
// Name-neutral by design: the project token, the payment token (USDC), the
// collection name/symbol and all metadata URIs are parameters/setters, so
// renaming the token, theme or collection later requires NO code change.

import {ERC721}          from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings}         from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title  AscensionNFT — the collection with on-chain tiers (N0..N5).
 * @notice A holder ASCENDS by burning the project token, or CANNIBALIZES by
 *         sacrificing lower NFTs. The tier lives on-chain; `tokenURI` serves
 *         dormant art (N0) or ascended art (N1..N5) so the image tracks progress.
 *
 * @dev    ARC NOTES
 *         - Mint is priced in an ERC-20 `payToken` (USDC, 6 decimals on Arc) and
 *           collected via transferFrom. We deliberately do NOT use msg.value:
 *           on Arc the native unit is USDC at 18 decimals while the USDC ERC-20
 *           is 6 decimals, so taking the ERC-20 avoids that 10^12 mismatch.
 *         - The burn/project token is a separate ERC-20 (`burnToken`), set after
 *           the token launches. Ascension costs are in that token's own units.
 */
contract AscensionNFT is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    uint8   public constant MAX_TIER = 5;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    uint256 public immutable MAX_SUPPLY;
    uint256 public totalMinted;

    mapping(uint256 => uint8)   public tier;          // tokenId => 0..5
    mapping(uint256 => uint256) public empoweredUntil; // tokenId => timestamp

    IERC20  public burnToken;   // project token burned to ascend (set after launch)
    IERC20  public payToken;    // USDC on Arc, used to pay mint
    address public treasury;    // receives mint proceeds (Major Oak Treasury)
    uint256 public mintPrice;   // price per NFT, in payToken units
    bool    public saleOpen;

    // cost to REACH each tier, in burnToken units. index = target tier.
    // defaults assume an 18-decimal token; adjust with setAscendCost if not.
    uint256[6] public ascendCost = [
        0,
        20_000e18,   // N1 activate
        80_000e18,   // N2
        320_000e18,  // N3
        1_000_000e18,// N4
        2_000_000e18 // N5
    ];

    string public dormantBaseURI;   // e.g. Arweave manifest for N0 art
    string public ascendedBaseURI;  // render service for N1..N5 art

    event Minted(address indexed to, uint256 indexed tokenId);
    event Ascended(uint256 indexed tokenId, uint8 fromTier, uint8 toTier, uint256 burned);
    event Cannibalized(uint256 indexed survivorId, uint8 toTier, uint256[] sacrificed);
    event Empowered(uint256 indexed tokenId, uint256 until, uint256 burned);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        address owner_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        require(maxSupply_ > 0, "supply=0");
        MAX_SUPPLY = maxSupply_;
    }

    // ── admin ────────────────────────────────────────────────
    function setBurnToken(IERC20 t) external onlyOwner { burnToken = t; }
    function setPayToken(IERC20 t)  external onlyOwner { payToken = t; }
    function setTreasury(address a) external onlyOwner { require(a != address(0), "0"); treasury = a; }
    function setMintPrice(uint256 p) external onlyOwner { mintPrice = p; }
    function setSale(bool open) external onlyOwner { saleOpen = open; }
    function setBaseURIs(string calldata dormant_, string calldata ascended_) external onlyOwner {
        dormantBaseURI = dormant_; ascendedBaseURI = ascended_;
    }
    function setAscendCost(uint256[6] calldata costs) external onlyOwner { ascendCost = costs; }

    // ── mint ─────────────────────────────────────────────────
    function mint(uint256 qty) external nonReentrant {
        require(saleOpen, "sale closed");
        require(qty > 0 && qty <= 20, "bad qty");
        require(totalMinted + qty <= MAX_SUPPLY, "sold out");
        require(treasury != address(0), "no treasury");
        payToken.safeTransferFrom(msg.sender, treasury, mintPrice * qty);
        for (uint256 i; i < qty; ++i) {
            uint256 id = ++totalMinted;
            _safeMint(msg.sender, id);
            emit Minted(msg.sender, id);
        }
    }

    /// @notice Owner reserve mint (team/treasury allocation), no payment.
    function ownerMint(address to, uint256 qty) external onlyOwner {
        require(totalMinted + qty <= MAX_SUPPLY, "sold out");
        for (uint256 i; i < qty; ++i) {
            uint256 id = ++totalMinted;
            _safeMint(to, id);
            emit Minted(to, id);
        }
    }

    // ── ascension ────────────────────────────────────────────
    /// @notice N0 -> N1: burn the activation cost of the project token.
    function activate(uint256 tokenId) external nonReentrant {
        _ascendTo(tokenId, 1);
    }

    /// @notice Nt -> Nt+1 for t in 1..4: burn that tier's cost.
    function ascend(uint256 tokenId) external nonReentrant {
        _ascendTo(tokenId, tier[tokenId] + 1);
    }

    function _ascendTo(uint256 tokenId, uint8 target) internal {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(target == tier[tokenId] + 1 && target <= MAX_TIER, "bad tier");
        uint256 cost = ascendCost[target];
        _burnProject(cost);
        uint8 from = tier[tokenId];
        tier[tokenId] = target;
        emit Ascended(tokenId, from, target, cost);
    }

    /// @notice Ascend by SACRIFICE instead of token: to reach tier `target` on
    ///         `survivorId`, burn NFTs — one at each tier from target-1 down to N0.
    ///         (e.g. reach N2 => sacrifice one N1 and ... configurable off-chain UI.)
    ///         Here: sacrifice `target` NFTs, the j-th at tier (target-j).
    function cannibalize(uint256 survivorId, uint256[] calldata sacrificeIds)
        external nonReentrant
    {
        require(ownerOf(survivorId) == msg.sender, "not owner");
        uint8 target = tier[survivorId] + 1;
        require(target <= MAX_TIER, "max tier");
        require(sacrificeIds.length == target, "wrong sacrifice count");
        for (uint256 j; j < sacrificeIds.length; ++j) {
            uint256 sid = sacrificeIds[j];
            require(sid != survivorId, "self");
            require(ownerOf(sid) == msg.sender, "not owner of sac");
            require(tier[sid] == target - uint8(j + 1), "sac wrong tier");
            _burn(sid);
        }
        tier[survivorId] = target;
        emit Cannibalized(survivorId, target, sacrificeIds);
    }

    /// @notice Temporary boost: burn project token for a 30-day empower window.
    function empower(uint256 tokenId, uint256 amount) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(amount > 0, "amount=0");
        _burnProject(amount);
        uint256 until = block.timestamp + 30 days;
        empoweredUntil[tokenId] = until;
        emit Empowered(tokenId, until, amount);
    }

    function _burnProject(uint256 amount) internal {
        require(address(burnToken) != address(0), "burn token unset");
        if (amount > 0) burnToken.safeTransferFrom(msg.sender, DEAD, amount);
    }

    // ── metadata ─────────────────────────────────────────────
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint8 t = tier[tokenId];
        if (t == 0) {
            return string.concat(dormantBaseURI, tokenId.toString(), ".json");
        }
        return string.concat(
            ascendedBaseURI, uint256(t).toString(), "/", tokenId.toString(), ".json"
        );
    }
}
