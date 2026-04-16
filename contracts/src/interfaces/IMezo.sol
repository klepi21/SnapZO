// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Mezo MUSD vault (also the sMUSD ERC-20 share token at the same address).
interface IMusdVault is IERC20 {
    function deposit(uint256 assets) external;

    /// @dev Burns `shares` from `msg.sender` and sends MUSD back.
    function withdraw(uint256 shares) external;

    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    function convertToAssets(uint256 shares) external view returns (uint256 assets);
}

interface ISmusdGauge {
    function deposit(uint256 amount, address receiver) external;

    function withdraw(uint256 amount) external;

    function balanceOf(address account) external view returns (uint256);

    function getReward(address account) external;

    function stakingToken() external view returns (address);

    function rewardToken() external view returns (address);
}

/// @dev Solidly-style router on Mezo testnet.
interface IMezoRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);

    function getAmountsOut(uint256 amountIn, Route[] calldata routes)
        external
        view
        returns (uint256[] memory amounts);
}

interface IERC20Permit is IERC20 {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
