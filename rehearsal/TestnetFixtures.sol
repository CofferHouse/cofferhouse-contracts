// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
interface IMembershipMint {function mintSeaDrop(address minter,uint256 quantity) external;}
/// @notice Test-only token. Not the production COFFERS token.
contract TestCOFFERS is ERC20 {
    constructor() ERC20("CofferHouse rehearsal token", "TESTCOFFERS") {
        require(block.chainid == 5042002, "Arc testnet only");
        _mint(msg.sender, 1000000000 ether);
    }
}
/// @notice Test-only authorized mint relay; NOT OpenSea SeaDrop.
contract TestMintRelay {
    address public immutable owner = msg.sender;
    constructor(){require(block.chainid == 5042002,"Arc testnet only");}
    function mint(address nft,address to,uint256 quantity) external {
        require(msg.sender==owner,"not owner");
        IMembershipMint(nft).mintSeaDrop(to,quantity);
    }
}
