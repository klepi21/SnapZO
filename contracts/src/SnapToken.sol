// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Receipt token for SnapZo pooled MUSD strategy; only the hub may mint/burn.
contract SnapToken is ERC20 {
    address public immutable minter;

    error SnapToken__NotMinter();

    constructor(address minter_) ERC20("SnapZo Mezo Share", "SNAP") {
        minter = minter_;
    }

    /// @notice 6 decimals so on-chain amounts stay human-sized (1 MUSD → 1e6 base units on first mint).
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    modifier onlyMinter() {
        if (msg.sender != minter) revert SnapToken__NotMinter();
        _;
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyMinter {
        _burn(from, amount);
    }
}
