// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title SnapZoSubscriptions
/// @notice OnlySnaps monthly subscriptions (one plan per creator), relayed via EIP-712 signatures.
contract SnapZoSubscriptions is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    uint256 public constant SUBSCRIPTION_PERIOD = 30 days;
    bytes32 private constant SUBSCRIBE_TYPEHASH =
        keccak256("Subscribe(address subscriber,address creator,uint256 amount,uint256 nonce,uint256 deadline)");

    IERC20 public snapToken;
    mapping(address => bool) public isRelayer;
    mapping(address => uint256) public nonces;

    /// @notice One monthly plan per creator, denominated in SNAP base units.
    mapping(address => uint256) public monthlyPrice;
    /// @notice Expiry timestamp for creator -> subscriber access.
    mapping(address => mapping(address => uint48)) public expiresAt;

    error SnapZoSubscriptions__ZeroAddress();
    error SnapZoSubscriptions__ZeroAmount();
    error SnapZoSubscriptions__PlanNotSet();
    error SnapZoSubscriptions__BadAmount();
    error SnapZoSubscriptions__Expired();
    error SnapZoSubscriptions__BadNonce();
    error SnapZoSubscriptions__BadSignature();
    error SnapZoSubscriptions__NotRelayer();

    event RelayerUpdated(address indexed relayer, bool allowed);
    event PlanUpdated(address indexed creator, uint256 monthlyPriceSnap);
    event Subscribed(
        address indexed subscriber,
        address indexed creator,
        uint256 amount,
        uint48 periodStart,
        uint48 periodEnd,
        address relayer
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, IERC20 snapToken_, address[] calldata relayers) external initializer {
        if (owner_ == address(0)) revert SnapZoSubscriptions__ZeroAddress();
        if (address(snapToken_) == address(0)) revert SnapZoSubscriptions__ZeroAddress();

        __Ownable_init(owner_);
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init("SnapZoSubscriptions", "1");
        __UUPSUpgradeable_init();

        snapToken = snapToken_;

        isRelayer[owner_] = true;
        emit RelayerUpdated(owner_, true);

        uint256 n = relayers.length;
        for (uint256 i; i < n;) {
            address r = relayers[i];
            if (r != address(0) && !isRelayer[r]) {
                isRelayer[r] = true;
                emit RelayerUpdated(r, true);
            }
            unchecked {
                ++i;
            }
        }
    }

    function setMonthlyPrice(uint256 price) external whenNotPaused {
        if (price == 0) revert SnapZoSubscriptions__ZeroAmount();
        monthlyPrice[msg.sender] = price;
        emit PlanUpdated(msg.sender, price);
    }

    function subscribeWithSig(
        address subscriber,
        address creator,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        if (subscriber == address(0) || creator == address(0)) revert SnapZoSubscriptions__ZeroAddress();
        if (amount == 0) revert SnapZoSubscriptions__ZeroAmount();
        if (block.timestamp > deadline) revert SnapZoSubscriptions__Expired();

        uint256 price = monthlyPrice[creator];
        if (price == 0) revert SnapZoSubscriptions__PlanNotSet();
        if (amount != price) revert SnapZoSubscriptions__BadAmount();

        bytes32 structHash =
            keccak256(abi.encode(SUBSCRIBE_TYPEHASH, subscriber, creator, amount, nonce, deadline));
        _verifySig(subscriber, structHash, signature);
        _useNonce(subscriber, nonce);

        uint48 currentExpiry = expiresAt[creator][subscriber];
        uint48 start = currentExpiry > uint48(block.timestamp) ? currentExpiry : uint48(block.timestamp);
        uint48 end = start + uint48(SUBSCRIPTION_PERIOD);
        expiresAt[creator][subscriber] = end;

        snapToken.safeTransferFrom(subscriber, address(this), amount);
        snapToken.safeTransfer(creator, amount);

        emit Subscribed(subscriber, creator, amount, start, end, msg.sender);
    }

    function hasActiveSubscription(address creator, address subscriber) external view returns (bool) {
        return expiresAt[creator][subscriber] > block.timestamp;
    }

    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _useNonce(address user, uint256 nonce) internal {
        if (nonce != nonces[user]) revert SnapZoSubscriptions__BadNonce();
        unchecked {
            nonces[user] = nonce + 1;
        }
    }

    function _verifySig(address signer, bytes32 structHash, bytes calldata signature) internal view {
        bytes32 digest = _hashTypedDataV4(structHash);
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != signer) {
            revert SnapZoSubscriptions__BadSignature();
        }
    }

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert SnapZoSubscriptions__NotRelayer();
        _;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[43] private __gap;
}
