// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title SnapZoRewards
/// @notice Pull-based MEZO reward distribution for SnapZo creators using Merkle Proofs.
/// @dev Receives 10% of Hub fees; rewards are claimable by creators per epoch.
contract SnapZoRewards is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    address public relayer;
    
    // Cycle/Epoch => MerkleRoot
    mapping(uint256 => bytes32) public roots;
    // Cycle => User => HasClaimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    // Timestamp of the last root update
    uint256 public lastUpdateTimestamp;

    error SnapZoRewards__AlreadyClaimed();
    error SnapZoRewards__InvalidProof();
    error SnapZoRewards__NotExpired();
    error SnapZoRewards__NotAuthorized();
    error SnapZoRewards__ZeroAddress();

    event RootUpdated(uint256 indexed cycle, bytes32 indexed root);
    event RewardClaimed(uint256 indexed cycle, address indexed user, uint256 amount);
    event RelayerUpdated(address indexed relayer);

    constructor(address initialOwner, address rewardToken_, address relayer_) Ownable(initialOwner) {
        if (rewardToken_ == address(0) || relayer_ == address(0)) revert SnapZoRewards__ZeroAddress();
        rewardToken = IERC20(rewardToken_);
        relayer = relayer_;
        lastUpdateTimestamp = block.timestamp;
    }

    modifier onlyAuthorized() {
        if (msg.sender != owner() && msg.sender != relayer) revert SnapZoRewards__NotAuthorized();
        _;
    }

    function setRelayer(address relayer_) external onlyOwner {
        if (relayer_ == address(0)) revert SnapZoRewards__ZeroAddress();
        relayer = relayer_;
        emit RelayerUpdated(relayer_);
    }

    /// @notice Update the Merkle root for a specific distribution cycle.
    /// @param cycle The epoch identifier (e.g., 1, 2, 3...).
    /// @param root The Merkle root of the (address, amount) leaves.
    function updateRoot(uint256 cycle, bytes32 root) external onlyAuthorized whenNotPaused {
        roots[cycle] = root;
        lastUpdateTimestamp = block.timestamp;
        emit RootUpdated(cycle, root);
    }

    /// @notice Creators claim their rewards by providing a Merkle proof.
    /// @param cycle The epoch they are claiming for.
    /// @param amount The amount of MEZO they are entitled to in this cycle.
    /// @param proof The Merkle proof.
    function claim(uint256 cycle, uint256 amount, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        if (hasClaimed[cycle][msg.sender]) revert SnapZoRewards__AlreadyClaimed();
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, roots[cycle], leaf)) revert SnapZoRewards__InvalidProof();

        hasClaimed[cycle][msg.sender] = true;
        rewardToken.safeTransfer(msg.sender, amount);

        emit RewardClaimed(cycle, msg.sender, amount);
    }

    /// @notice Owner pulls unclaimed rewards if no update has happened in 2 months.
    /// @dev Safety mechanism for inactive contracts.
    function withdrawUnclaimed(uint256 amount) external onlyOwner {
        if (block.timestamp < lastUpdateTimestamp + 60 days) revert SnapZoRewards__NotExpired();
        rewardToken.safeTransfer(msg.sender, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
