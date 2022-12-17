// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "./ERC20.sol";

contract ZLOI is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint32 currentChainId_
    ) ERC20(name_, symbol_, totalSupply_, currentChainId_) {}
}
