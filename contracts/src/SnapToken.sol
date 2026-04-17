// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ISnapZoHubHook} from "./interfaces/ISnapZoHubHook.sol";

/// @notice Receipt token for SnapZo pooled MUSD strategy; only the hub may mint/burn.
/// @dev Notifies the hub on every transfer so MEZO reward debt stays correct when SNAP moves wallets.
contract SnapToken is ERC20 {
    address public immutable minter;

    error SnapToken__NotMinter();

    constructor(address minter_) ERC20("SnapZo Mezo Share", "SNAP") {
        minter = minter_;
    }

    /// @notice 18 decimals to match Mezo sMUSD (vault share) wei — SNAP minted 1:1 with ΔsMUSD on deposit.
    function decimals() public pure override returns (uint8) {
        return 18;
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

    function _update(address from, address to, uint256 value) internal override {
        ISnapZoHubHook(minter).snapTransferHook(from, to, value);
        super._update(from, to, value);
    }
}
