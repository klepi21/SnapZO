// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IMusdVault, ISmusdGauge} from "../src/interfaces/IMezo.sol";

contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

/// @dev 1:1 MUSD <-> share vault for tests.
contract MockVault is ERC20, IMusdVault {
    IERC20 public immutable underlying;

    constructor(IERC20 musd_) ERC20("sMUSD", "sMUSD") {
        underlying = musd_;
    }

    function deposit(uint256 assets) external {
        underlying.transferFrom(msg.sender, address(this), assets);
        _mint(msg.sender, assets);
    }

    function withdraw(uint256 shares) external {
        _burn(msg.sender, shares);
        underlying.transfer(msg.sender, shares);
    }

    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function convertToShares(uint256 assets) external pure returns (uint256) {
        return assets;
    }
}

contract MockGauge is ISmusdGauge {
    IERC20 public immutable stakeToken;
    IERC20 public reward;

    mapping(address => uint256) internal _staked;

    constructor(IERC20 stake_, IERC20 reward_) {
        stakeToken = stake_;
        reward = reward_;
    }

    function deposit(uint256 amount, address receiver) external {
        stakeToken.transferFrom(msg.sender, address(this), amount);
        _staked[receiver] += amount;
    }

    function withdraw(uint256 amount) external {
        uint256 s = _staked[msg.sender];
        require(s >= amount, "stake");
        _staked[msg.sender] = s - amount;
        stakeToken.transfer(msg.sender, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _staked[account];
    }

    function getReward(address account) external {
        uint256 b = reward.balanceOf(address(this));
        if (b > 0) {
            reward.transfer(account, b);
        }
    }

    function stakingToken() external view returns (address) {
        return address(stakeToken);
    }

    function rewardToken() external view returns (address) {
        return address(reward);
    }

    function seedReward(uint256 amt) external {
        reward.transferFrom(msg.sender, address(this), amt);
    }
}
