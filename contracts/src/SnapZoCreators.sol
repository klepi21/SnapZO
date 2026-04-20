// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SnapZoCreators
/// @notice Claim-only creator rewards distributor with owner-indexed allocations.
/// @dev Owner/relayer can index allocations off-chain and batch write on-chain.
contract SnapZoCreators is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant EXPIRY_PERIOD = 60 days; // 2 months

    IERC20 public immutable rewardToken;
    address public relayer;
    uint256 public lastUpdateTimestamp;

    mapping(address => uint256) public claimable;
    mapping(address => uint256) public claimed;

    error SnapZoCreators__ZeroAddress();
    error SnapZoCreators__LengthMismatch();
    error SnapZoCreators__InvalidBps();
    error SnapZoCreators__NotAuthorized();
    error SnapZoCreators__ZeroClaim();
    error SnapZoCreators__NotExpired();

    event RelayerUpdated(address indexed relayer);
    event AllocationSet(address indexed user, uint256 amount, bool reset);
    event AllocationIndexedByBps(
        address indexed user, uint256 poolAmount, uint256 bps, uint256 amount, bool reset
    );
    event RewardsClaimed(address indexed user, uint256 amount);

    constructor(address initialOwner, address rewardToken_, address relayer_) Ownable(initialOwner) {
        if (rewardToken_ == address(0) || relayer_ == address(0)) revert SnapZoCreators__ZeroAddress();
        rewardToken = IERC20(rewardToken_);
        relayer = relayer_;
        lastUpdateTimestamp = block.timestamp;
    }

    modifier onlyAuthorized() {
        if (msg.sender != owner() && msg.sender != relayer) revert SnapZoCreators__NotAuthorized();
        _;
    }

    function setRelayer(address relayer_) external onlyOwner {
        if (relayer_ == address(0)) revert SnapZoCreators__ZeroAddress();
        relayer = relayer_;
        emit RelayerUpdated(relayer_);
    }

    /// @notice Batch set claimable allocations by exact amounts.
    /// @param users Target user addresses.
    /// @param amounts Claimable amounts aligned with `users`.
    /// @param reset If true, overwrite claimable with amount; else add to existing claimable.
    function setAllocations(address[] calldata users, uint256[] calldata amounts, bool reset)
        external
        onlyAuthorized
        whenNotPaused
    {
        uint256 n = users.length;
        if (n != amounts.length) revert SnapZoCreators__LengthMismatch();
        for (uint256 i = 0; i < n; ++i) {
            address user = users[i];
            if (user == address(0)) revert SnapZoCreators__ZeroAddress();
            uint256 amount = amounts[i];
            claimable[user] = reset ? amount : claimable[user] + amount;
            emit AllocationSet(user, amount, reset);
        }
        lastUpdateTimestamp = block.timestamp;
    }

    /// @notice Batch set claimable allocations by percentages of a pool amount.
    /// @param users Target user addresses.
    /// @param bps Basis points per user (sum is validated to MAX_BPS).
    /// @param poolAmount Amount to split proportionally.
    /// @param reset If true, overwrite claimable with computed amount; else add.
    function setAllocationsByBps(address[] calldata users, uint256[] calldata bps, uint256 poolAmount, bool reset)
        external
        onlyAuthorized
        whenNotPaused
    {
        uint256 n = users.length;
        if (n != bps.length) revert SnapZoCreators__LengthMismatch();
        uint256 totalBps = 0;
        for (uint256 i = 0; i < n; ++i) {
            totalBps += bps[i];
        }
        if (totalBps != MAX_BPS) revert SnapZoCreators__InvalidBps();

        for (uint256 i = 0; i < n; ++i) {
            address user = users[i];
            if (user == address(0)) revert SnapZoCreators__ZeroAddress();
            uint256 amount = (poolAmount * bps[i]) / MAX_BPS;
            claimable[user] = reset ? amount : claimable[user] + amount;
            emit AllocationIndexedByBps(user, poolAmount, bps[i], amount, reset);
        }
        lastUpdateTimestamp = block.timestamp;
    }

    /// @notice Claim full available allocation.
    function claim() external whenNotPaused nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert SnapZoCreators__ZeroClaim();
        claimable[msg.sender] = 0;
        claimed[msg.sender] += amount;
        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardsClaimed(msg.sender, amount);
    }

    /// @notice Owner can withdraw unclaimed funds if contract has been inactive for 60 days.
    function withdrawUnclaimed(uint256 amount) external onlyOwner {
        if (block.timestamp < lastUpdateTimestamp + EXPIRY_PERIOD) revert SnapZoCreators__NotExpired();
        rewardToken.safeTransfer(msg.sender, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
