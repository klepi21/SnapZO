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

/// @title SnapZoSocial
/// @notice Gasless (relayer) SNAP flows: tips, unlocks, paid-reply escrow. EIP-712 + whitelist relayers. UUPS.
/// @dev Part F — `docs/SC_PLAN.md`. SNAP is an external ERC-20 (typically `SnapToken` from `SnapZoHub`).
contract SnapZoSocial is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    uint256 public constant REPLY_WINDOW = 24 hours;

    bytes32 private constant TIP_TYPEHASH =
        keccak256("Tip(address tipper,uint256 postId,address creator,uint256 nonce,uint256 deadline)");
    bytes32 private constant UNLOCK_TYPEHASH = keccak256(
        "Unlock(address unlocker,uint256 postId,address creator,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant REPLY_DEPOSIT_TYPEHASH = keccak256(
        "ReplyDeposit(address payer,uint256 postId,address creator,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant FULFILL_REPLY_TYPEHASH = keccak256(
        "FulfillReply(address creator,bytes32 requestId,uint256 commentId,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant REFUND_REPLY_TYPEHASH =
        keccak256("RefundReply(address requester,bytes32 requestId,uint256 nonce,uint256 deadline)");

    IERC20 public snapToken;
    mapping(address => bool) public isRelayer;
    /// @notice Sequential nonce per address (tip, unlock, reply deposit, fulfill, refund).
    mapping(address => uint256) public nonces;

    uint256 public likeTipAmount;
    uint256 public replyStakeAmount;

    struct ReplyLock {
        address requester;
        address creator;
        uint256 postId;
        uint256 amount;
        uint48 refundNotBefore;
        bool fulfilled;
    }

    mapping(bytes32 => ReplyLock) public replyLocks;

    error SnapZoSocial__ZeroAddress();
    error SnapZoSocial__Expired();
    error SnapZoSocial__BadNonce();
    error SnapZoSocial__BadSignature();
    error SnapZoSocial__NotRelayer();
    error SnapZoSocial__ZeroAmount();
    error SnapZoSocial__UnknownRequest();
    error SnapZoSocial__ReplyRequestExists();
    error SnapZoSocial__AlreadyFulfilled();
    error SnapZoSocial__ReplyWindowClosed();
    error SnapZoSocial__RefundTooEarly();

    event RelayerUpdated(address indexed relayer, bool allowed);
    event LikeTipAmountUpdated(uint256 amount);
    event ReplyStakeAmountUpdated(uint256 amount);
    event Tip(
        address indexed tipper,
        address indexed creator,
        uint256 indexed postId,
        uint256 amount,
        address relayer
    );
    event Unlock(
        address indexed unlocker,
        address indexed creator,
        uint256 indexed postId,
        uint256 amount,
        address relayer
    );
    event ReplyDeposited(
        bytes32 indexed requestId,
        address indexed payer,
        address indexed creator,
        uint256 postId,
        uint256 amount,
        uint48 refundNotBefore,
        address relayer
    );
    event ReplyFulfilled(
        bytes32 indexed requestId, address indexed creator, uint256 commentId, uint256 amount, address relayer
    );
    event ReplyRefunded(bytes32 indexed requestId, address indexed requester, uint256 amount, address relayer);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        IERC20 snapToken_,
        uint256 likeTipAmount_,
        uint256 replyStakeAmount_,
        address[] calldata relayers
    ) external initializer {
        if (owner_ == address(0)) revert SnapZoSocial__ZeroAddress();
        if (address(snapToken_) == address(0)) revert SnapZoSocial__ZeroAddress();

        __Ownable_init(owner_);
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init("SnapZoSocial", "1");
        __UUPSUpgradeable_init();

        snapToken = snapToken_;
        likeTipAmount = likeTipAmount_;
        replyStakeAmount = replyStakeAmount_;

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

    function setLikeTipAmount(uint256 amount) external onlyOwner {
        likeTipAmount = amount;
        emit LikeTipAmountUpdated(amount);
    }

    function setReplyStakeAmount(uint256 amount) external onlyOwner {
        replyStakeAmount = amount;
        emit ReplyStakeAmountUpdated(amount);
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

    /// @notice EIP-712 domain separator (`eth_signTypedData_v4`).
    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Relayer submits fan-signed tip; pulls `likeTipAmount` SNAP to `creator`.
    function tipWithSig(
        address tipper,
        uint256 postId,
        address creator,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        if (creator == address(0) || tipper == address(0)) revert SnapZoSocial__ZeroAddress();
        if (likeTipAmount == 0) revert SnapZoSocial__ZeroAmount();
        _verifyTipSig(tipper, postId, creator, nonce, deadline, signature);
        _useNonce(tipper, nonce);

        uint256 amt = likeTipAmount;
        snapToken.safeTransferFrom(tipper, address(this), amt);
        snapToken.safeTransfer(creator, amt);

        emit Tip(tipper, creator, postId, amt, msg.sender);
    }

    /// @notice Relayer submits unlock; pulls exact `amount` SNAP per signed intent (DB price at sign time).
    function unlockWithSig(
        address unlocker,
        uint256 postId,
        address creator,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        if (creator == address(0) || unlocker == address(0)) revert SnapZoSocial__ZeroAddress();
        if (amount == 0) revert SnapZoSocial__ZeroAmount();
        _verifyUnlockSig(unlocker, postId, creator, amount, nonce, deadline, signature);
        _useNonce(unlocker, nonce);

        snapToken.safeTransferFrom(unlocker, address(this), amount);
        snapToken.safeTransfer(creator, amount);

        emit Unlock(unlocker, creator, postId, amount, msg.sender);
    }

    /// @notice Opens paid-reply escrow. `requestId` uses current `nonces[payer]` before increment (see Part F).
    function replyDepositWithSig(
        address payer,
        uint256 postId,
        address creator,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        if (creator == address(0) || payer == address(0)) revert SnapZoSocial__ZeroAddress();
        uint256 stake = replyStakeAmount;
        if (stake == 0) revert SnapZoSocial__ZeroAmount();

        _verifyReplyDepositSig(payer, postId, creator, nonce, deadline, signature);

        bytes32 requestId = _requestId(postId, creator, payer, nonce);
        if (replyLocks[requestId].requester != address(0)) revert SnapZoSocial__ReplyRequestExists();

        _useNonce(payer, nonce);

        uint48 refundNotBefore = uint48(block.timestamp + REPLY_WINDOW);
        replyLocks[requestId] = ReplyLock({
            requester: payer,
            creator: creator,
            postId: postId,
            amount: stake,
            refundNotBefore: refundNotBefore,
            fulfilled: false
        });

        snapToken.safeTransferFrom(payer, address(this), stake);

        emit ReplyDeposited(requestId, payer, creator, postId, stake, refundNotBefore, msg.sender);
    }

    /// @notice Creator fulfills within 24h; SNAP goes to creator. `commentId` is for off-chain DB.
    function fulfillReplyWithSig(
        address creator_,
        bytes32 requestId,
        uint256 commentId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        ReplyLock storage lock = replyLocks[requestId];
        if (lock.requester == address(0)) revert SnapZoSocial__UnknownRequest();
        if (lock.fulfilled) revert SnapZoSocial__AlreadyFulfilled();
        if (block.timestamp >= lock.refundNotBefore) revert SnapZoSocial__ReplyWindowClosed();

        _verifyFulfillSig(creator_, requestId, commentId, nonce, deadline, signature);
        _useNonce(creator_, nonce);
        if (creator_ != lock.creator) revert SnapZoSocial__BadSignature();

        lock.fulfilled = true;
        snapToken.safeTransfer(creator_, lock.amount);

        emit ReplyFulfilled(requestId, creator_, commentId, lock.amount, msg.sender);
    }

    /// @notice After 24h, requester reclaims stake if creator did not fulfill.
    function refundReplyWithSig(
        address requester,
        bytes32 requestId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        ReplyLock storage lock = replyLocks[requestId];
        if (lock.requester == address(0)) revert SnapZoSocial__UnknownRequest();
        if (lock.fulfilled) revert SnapZoSocial__AlreadyFulfilled();
        if (block.timestamp < lock.refundNotBefore) revert SnapZoSocial__RefundTooEarly();
        if (requester != lock.requester) revert SnapZoSocial__BadSignature();

        _verifyRefundSig(requester, requestId, nonce, deadline, signature);
        _useNonce(requester, nonce);

        uint256 amt = lock.amount;
        lock.fulfilled = true;
        snapToken.safeTransfer(requester, amt);

        emit ReplyRefunded(requestId, requester, amt, msg.sender);
    }

    function _requestId(uint256 postId, address creator, address payer, uint256 nonceUsed)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(block.chainid, address(this), postId, creator, payer, nonceUsed));
    }

    function _useNonce(address user, uint256 nonce) internal {
        if (nonce != nonces[user]) revert SnapZoSocial__BadNonce();
        unchecked {
            nonces[user] = nonce + 1;
        }
    }

    function _verifySig(address signer, bytes32 structHash, bytes calldata signature) internal view {
        bytes32 digest = _hashTypedDataV4(structHash);
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != signer) revert SnapZoSocial__BadSignature();
    }

    function _verifyTipSig(
        address tipper,
        uint256 postId,
        address creator,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SnapZoSocial__Expired();
        bytes32 structHash = keccak256(abi.encode(TIP_TYPEHASH, tipper, postId, creator, nonce, deadline));
        _verifySig(tipper, structHash, signature);
    }

    function _verifyUnlockSig(
        address unlocker,
        uint256 postId,
        address creator,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SnapZoSocial__Expired();
        bytes32 structHash =
            keccak256(abi.encode(UNLOCK_TYPEHASH, unlocker, postId, creator, amount, nonce, deadline));
        _verifySig(unlocker, structHash, signature);
    }

    function _verifyReplyDepositSig(
        address payer,
        uint256 postId,
        address creator,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SnapZoSocial__Expired();
        bytes32 structHash =
            keccak256(abi.encode(REPLY_DEPOSIT_TYPEHASH, payer, postId, creator, nonce, deadline));
        _verifySig(payer, structHash, signature);
    }

    function _verifyFulfillSig(
        address creator_,
        bytes32 requestId,
        uint256 commentId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SnapZoSocial__Expired();
        bytes32 structHash = keccak256(
            abi.encode(FULFILL_REPLY_TYPEHASH, creator_, requestId, commentId, nonce, deadline)
        );
        _verifySig(creator_, structHash, signature);
    }

    function _verifyRefundSig(
        address requester,
        bytes32 requestId,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SnapZoSocial__Expired();
        bytes32 structHash =
            keccak256(abi.encode(REFUND_REPLY_TYPEHASH, requester, requestId, nonce, deadline));
        _verifySig(requester, structHash, signature);
    }

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert SnapZoSocial__NotRelayer();
        _;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[44] private __gap;
}
