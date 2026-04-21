// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {SnapToken} from "./SnapToken.sol";
import {IERC20Permit, IMusdVault, ISmusdGauge, IMezoRouter} from "./interfaces/IMezo.sol";
import {ISnapZoHubHook} from "./interfaces/ISnapZoHubHook.sol";

/// @title SnapZoHub
/// @notice Pooled MUSD → vault → gauge strategy with SNAP receipt shares; relayer-gated EIP-712 deposit/withdraw.
/// @dev Gauge MEZO is claimed into the hub, fee is taken at indexing time, and net rewards are indexed to SNAP.
contract SnapZoHub is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable,
    ISnapZoHubHook
{
    using SafeERC20 for IERC20;

    uint256 public constant MIN_DEPOSIT = 1 ether;
    uint256 public constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 1_000;
    uint256 internal constant REWARD_PRECISION = 1e18;

    bytes32 private constant DEPOSIT_TYPEHASH =
        keccak256("Deposit(address user,uint256 assets,uint256 nonce,uint256 deadline)");
    bytes32 private constant WITHDRAW_TYPEHASH =
        keccak256("Withdraw(address user,uint256 snapAmount,uint256 nonce,uint256 deadline)");

    SnapToken public snapToken;
    IERC20 public musd;
    address public vault;
    address public gauge;
    address public router;
    IERC20 public rewardToken;
    address public feeReceiver;
    uint16 public feeBps;
    mapping(address => uint256) public nonces;
    mapping(address => bool) public isRelayer;
    bytes private _restakeRoutes;

    /// @notice Cumulative MEZO per SNAP (scaled by REWARD_PRECISION). Updated when gauge rewards hit the hub.
    uint256 public rewardPerTokenStored;
    /// @notice MEZO received while `totalSupply()==0`, later merged on first stake.
    uint256 public unallocatedReward;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    /// @notice Destination for creator rewards (Merkle distributor).
    /// @dev MUST stay appended for upgrade-safe storage layout.
    address public rewardContract;
    /// @notice One-time latch for `repairAfterBadV2Upgrade`.
    bool public repairApplied;

    error SnapZoHub__ZeroAddress();
    error SnapZoHub__Expired();
    error SnapZoHub__BadNonce();
    error SnapZoHub__BadSignature();
    error SnapZoHub__NotRelayer();
    error SnapZoHub__NotHarvester();
    error SnapZoHub__MinDeposit();
    error SnapZoHub__ZeroShares();
    error SnapZoHub__InsufficientSnap();
    error SnapZoHub__InsufficientLiquidity();
    error SnapZoHub__Denylisted();
    error SnapZoHub__FeeTooHigh();
    error SnapZoHub__ZeroAmount();
    error SnapZoHub__NotSnapToken();
    error SnapZoHub__RepairAlreadyApplied();
    error SnapZoHub__InsufficientRewardBalance();

    event Deposit(address indexed user, uint256 assets, uint256 sharesMinted, address indexed relayer);
    event Withdraw(
        address indexed user, uint256 sharesBurned, uint256 musdOut, uint256 mezoOut, address indexed relayer
    );
    event Harvest(uint256 rewardClaimed);
    event Restake(uint256 musdRestaked, bool swapSkipped);
    event RelayerUpdated(address indexed relayer, bool allowed);
    event RewardContractUpdated(address indexed rewardContract);
    event IntegrationsUpdated(address musd, address vault, address gauge, address router, address rewardToken);
    event RestakeRoutesUpdated(uint256 routeBytesLen);
    event RewardTokenRecovered(address indexed to, uint256 amount);
    event MusdInjectedWithoutMint(address indexed from, uint256 amount);
    event RepairApplied(address indexed rewardContract, uint256 usersReset);
    event ExistingRewardsIndexed(uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        IERC20 musd_,
        address vault_,
        address gauge_,
        address router_,
        IERC20 rewardToken_,
        address feeReceiver_,
        uint16 feeBps_,
        address[] calldata relayers
    ) external initializer {
        if (owner_ == address(0)) revert SnapZoHub__ZeroAddress();
        if (address(musd_) == address(0) || vault_ == address(0) || gauge_ == address(0)) {
            revert SnapZoHub__ZeroAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) revert SnapZoHub__FeeTooHigh();

        __Ownable_init(owner_);
        __Pausable_init();
        __ReentrancyGuard_init();
        __EIP712_init("SnapZoHub", "1");
        __UUPSUpgradeable_init();

        snapToken = new SnapToken(address(this));
        musd = musd_;
        vault = vault_;
        gauge = gauge_;
        router = router_;
        rewardToken = rewardToken_;
        feeReceiver = feeReceiver_ == address(0) ? owner_ : feeReceiver_;
        feeBps = feeBps_;

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

    /// @inheritdoc ISnapZoHubHook
    function snapTransferHook(address from, address to, uint256) external override {
        if (msg.sender != address(snapToken)) revert SnapZoHub__NotSnapToken();
        _updateReward(from);
        _updateReward(to);
    }

    /// @notice Pending MEZO claimable on full balance (before withdraw fee); use for UI.
    function earned(address account) public view returns (uint256) {
        if (account == address(0) || account == address(this)) {
            return 0;
        }
        uint256 bal = snapToken.balanceOf(account);
        uint256 paid = userRewardPerTokenPaid[account];
        if (rewardPerTokenStored <= paid) {
            return rewards[account];
        }
        uint256 pending = (bal * (rewardPerTokenStored - paid)) / REWARD_PRECISION;
        return rewards[account] + pending;
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    /// @notice `feeBps` applies to newly indexed MEZO (not MUSD principal).
    function setFee(uint16 feeBps_, address feeReceiver_) external onlyOwner {
        if (feeBps_ > 2000) revert SnapZoHub__FeeTooHigh();
        feeBps = feeBps_;
        if (feeReceiver_ != address(0)) {
            feeReceiver = feeReceiver_;
        }
    }

    function setRewardContract(address rewardContract_) external onlyOwner {
        if (rewardContract_ == address(0)) revert SnapZoHub__ZeroAddress();
        rewardContract = rewardContract_;
        emit RewardContractUpdated(rewardContract_);
    }

    function setIntegrations(
        IERC20 musd_,
        address vault_,
        address gauge_,
        address router_,
        IERC20 rewardToken_
    ) external onlyOwner whenPaused {
        if (address(musd_) == address(0) || vault_ == address(0) || gauge_ == address(0)) {
            revert SnapZoHub__ZeroAddress();
        }
        musd = musd_;
        vault = vault_;
        gauge = gauge_;
        router = router_;
        rewardToken = rewardToken_;
        emit IntegrationsUpdated(address(musd_), vault_, gauge_, router, address(rewardToken_));
    }

    function setRestakeRoutes(bytes calldata encodedRoutes) external onlyOwner whenPaused {
        _restakeRoutes = encodedRoutes;
        emit RestakeRoutesUpdated(encodedRoutes.length);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice MUSD-denominated assets under management (idle MUSD + vault conversion of all sMUSD).
    function totalAssets() public view returns (uint256) {
        uint256 musdOnHub = musd.balanceOf(address(this));
        uint256 sIdle = IMusdVault(vault).balanceOf(address(this));
        uint256 sStaked = ISmusdGauge(gauge).balanceOf(address(this));
        uint256 shares = sIdle + sStaked;
        if (shares == 0) {
            return musdOnHub;
        }
        return musdOnHub + _assetsFromVaultShares(shares);
    }

    /// @dev sMUSD (vault + gauge) wei controlled by the hub — SNAP mints 1:1 with increases from deposits.
    function _hubSmUsdShares() internal view returns (uint256) {
        return IMusdVault(vault).balanceOf(address(this)) + ISmusdGauge(gauge).balanceOf(address(this));
    }

    function _assetsFromVaultShares(uint256 shares) internal view returns (uint256) {
        try IMusdVault(vault).previewRedeem(shares) returns (uint256 a) {
            return a;
        } catch {
            try IMusdVault(vault).convertToAssets(shares) returns (uint256 a2) {
                return a2;
            } catch {
                uint256 ts = IMusdVault(vault).totalSupply();
                if (ts == 0) return 0;
                return (musd.balanceOf(vault) * shares) / ts;
            }
        }
    }

    function depositWithSig(
        address user,
        uint256 assets,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        _useNonce(user, nonce);
        _verifyDepositSig(user, assets, nonce, deadline, signature);
        _deposit(user, assets);
    }

    function depositWithSigAndPermit(
        address user,
        uint256 assets,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant onlyRelayer {
        IERC20Permit(address(musd)).permit(user, address(this), assets, permitDeadline, v, r, s);
        _useNonce(user, nonce);
        _verifyDepositSig(user, assets, nonce, deadline, signature);
        _deposit(user, assets);
    }

    function withdrawWithSig(
        address user,
        uint256 snapAmount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused nonReentrant onlyRelayer {
        _useNonce(user, nonce);
        _verifyWithdrawSig(user, snapAmount, nonce, deadline, signature);
        _withdraw(user, snapAmount);
    }

    /// @notice Pull gauge MEZO to the hub and increase `rewardPerTokenStored` (no fee here).
    function harvest() external whenNotPaused nonReentrant onlyHarvester {
        uint256 d = _syncGaugeRewards();
        emit Harvest(d);
    }

    /// @notice Owner-only gauge sync (same as harvest reward leg).
    function syncGaugeRewards() external whenNotPaused nonReentrant onlyOwner {
        uint256 d = _syncGaugeRewards();
        emit Harvest(d);
    }

    function restake() external whenNotPaused nonReentrant onlyHarvester {
        // Gauge MEZO is owed to SNAP holders via `rewardPerTokenStored`; do not swap rewardToken here.
        uint256 musdBal = musd.balanceOf(address(this));
        if (musdBal > 0) {
            musd.forceApprove(vault, musdBal);
            IMusdVault(vault).deposit(musdBal);
            uint256 s = IMusdVault(vault).balanceOf(address(this));
            if (s > 0) {
                IERC20(vault).forceApprove(gauge, s);
                ISmusdGauge(gauge).deposit(s, address(this));
            }
        }
        emit Restake(musdBal, true);
    }

    function sweep(address token, uint256 amount) external onlyOwner whenPaused {
        if (_denylisted(token)) revert SnapZoHub__Denylisted();
        IERC20(token).safeTransfer(owner(), amount);
    }

    /// @notice Send reward tokens held by the hub to `to`. Paused only — avoids draining indexed MEZO while live.
    function recoverRewardToken(address to, uint256 amount) external onlyOwner whenPaused nonReentrant {
        if (to == address(0)) revert SnapZoHub__ZeroAddress();
        rewardToken.safeTransfer(to, amount);
        emit RewardTokenRecovered(to, amount);
    }

    /// @notice Owner pulls MUSD into the strategy (vault→gauge) without minting SNAP — boosts NAV for existing SNAP holders.
    /// @dev Approve this hub for `amount` on MUSD before calling.
    function injectMusdWithoutMint(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert SnapZoHub__ZeroAmount();
        musd.safeTransferFrom(msg.sender, address(this), amount);
        _pushToStrategy(amount);
        emit MusdInjectedWithoutMint(msg.sender, amount);
    }

    /**
     * @notice Owner-only backfill: index reward tokens already held on hub into SNAP rewards.
     * @dev Useful after repair/recovery so existing hub MEZO becomes claimable via `earned()`.
     *      Paused-only to avoid mutating index during active user operations.
     */
    function indexExistingRewards(uint256 amount) external onlyOwner whenPaused nonReentrant {
        if (amount == 0) revert SnapZoHub__ZeroAmount();
        uint256 ts = snapToken.totalSupply();
        if (ts == 0) revert SnapZoHub__ZeroShares();
        uint256 bal = rewardToken.balanceOf(address(this));
        if (amount > bal) revert SnapZoHub__InsufficientRewardBalance();
        uint256 net = _netAfterIndexFee(amount);
        if (net == 0) revert SnapZoHub__ZeroAmount();
        rewardPerTokenStored += (net * REWARD_PRECISION) / ts;
        emit ExistingRewardsIndexed(amount);
    }

    /**
     * @notice One-time emergency repair for state corruption caused by a bad storage-layout upgrade.
     * @dev Paused-only to avoid concurrent reward mutations.
     *      - Resets global reward index fields
     *      - Re-links reward contract
     *      - Optionally clears per-user reward debt/claimable for known affected users
     */
    function repairAfterBadV2Upgrade(address rewardContract_, address[] calldata usersToReset)
        external
        onlyOwner
        whenPaused
        nonReentrant
    {
        if (repairApplied) revert SnapZoHub__RepairAlreadyApplied();
        if (rewardContract_ == address(0)) revert SnapZoHub__ZeroAddress();

        rewardContract = rewardContract_;
        rewardPerTokenStored = 0;
        unallocatedReward = 0;

        uint256 n = usersToReset.length;
        for (uint256 i; i < n;) {
            address u = usersToReset[i];
            if (u != address(0) && u != address(this)) {
                rewards[u] = 0;
                userRewardPerTokenPaid[u] = 0;
            }
            unchecked {
                ++i;
            }
        }

        repairApplied = true;
        emit RewardContractUpdated(rewardContract_);
        emit RepairApplied(rewardContract_, n);
    }

    /// @notice EIP-712 domain separator for `eth_signTypedData_v4` (verifying contract is this hub/proxy).
    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function previewRestakeOut(uint256 rewardIn) external view returns (uint256 musdOut) {
        if (rewardIn == 0 || router == address(0) || _restakeRoutes.length == 0) {
            return 0;
        }
        IMezoRouter.Route[] memory routes = abi.decode(_restakeRoutes, (IMezoRouter.Route[]));
        return _quoteRewardToMusd(rewardIn, routes);
    }

    function _quoteRewardToMusd(uint256 rewardIn, IMezoRouter.Route[] memory routes)
        internal
        view
        returns (uint256)
    {
        if (routes.length == 0) return 0;
        try IMezoRouter(router).getAmountsOut(rewardIn, routes) returns (uint256[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function _denylisted(address token) internal view returns (bool) {
        return token == address(musd) || token == address(snapToken) || token == address(rewardToken)
            || token == vault;
    }

    function _useNonce(address user, uint256 nonce) internal {
        if (nonce != nonces[user]) revert SnapZoHub__BadNonce();
        unchecked {
            nonces[user] = nonce + 1;
        }
    }

    function _verifyDepositSig(
        address user,
        uint256 assets,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SnapZoHub__Expired();
        if (assets < MIN_DEPOSIT) revert SnapZoHub__MinDeposit();
        bytes32 structHash =
            keccak256(abi.encode(DEPOSIT_TYPEHASH, user, assets, nonce, deadline));
        _verifySig(user, structHash, signature);
    }

    function _verifyWithdrawSig(
        address user,
        uint256 snapAmount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) internal view {
        if (block.timestamp > deadline) revert SnapZoHub__Expired();
        if (snapAmount == 0) revert SnapZoHub__ZeroShares();
        bytes32 structHash =
            keccak256(abi.encode(WITHDRAW_TYPEHASH, user, snapAmount, nonce, deadline));
        _verifySig(user, structHash, signature);
    }

    function _verifySig(address signer, bytes32 structHash, bytes calldata signature) internal view {
        bytes32 digest = _hashTypedDataV4(structHash);
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != signer) revert SnapZoHub__BadSignature();
    }

    function _deposit(address user, uint256 assets) internal {
        _updateReward(user);
        _syncGaugeRewards();

        uint256 sBefore = _hubSmUsdShares();
        musd.safeTransferFrom(user, address(this), assets);
        _pushToStrategy(assets);
        uint256 sAfter = _hubSmUsdShares();
        uint256 ds = sAfter - sBefore;
        if (ds == 0) revert SnapZoHub__ZeroShares();
        snapToken.mint(user, ds);
        _mergeUnallocatedRewards();
        _updateReward(user);
        emit Deposit(user, assets, ds, msg.sender);
    }

    function _pushToStrategy(uint256 musdAmount) internal {
        musd.forceApprove(vault, musdAmount);
        IMusdVault(vault).deposit(musdAmount);
        uint256 s = IMusdVault(vault).balanceOf(address(this));
        if (s > 0) {
            IERC20(vault).forceApprove(gauge, s);
            ISmusdGauge(gauge).deposit(s, address(this));
        }
    }

    function _withdraw(address user, uint256 snapAmount) internal {
        if (snapToken.balanceOf(user) < snapAmount) revert SnapZoHub__InsufficientSnap();

        _updateReward(user);
        _syncGaugeRewards();
        _updateReward(user);

        uint256 supplyBefore = snapToken.totalSupply();
        if (supplyBefore == 0) revert SnapZoHub__ZeroShares();
        uint256 balBefore = snapToken.balanceOf(user);
        uint256 materialized = rewards[user];
        uint256 mezoGross = Math.min((materialized * snapAmount) / balBefore, materialized);
        rewards[user] = materialized - mezoGross;

        uint256 stIdle = IMusdVault(vault).balanceOf(address(this));
        uint256 stStaked = ISmusdGauge(gauge).balanceOf(address(this));
        uint256 totalS = stIdle + stStaked;
        uint256 toFreeShares = Math.mulDiv(snapAmount, totalS, supplyBefore, Math.Rounding.Floor);
        if (toFreeShares == 0) revert SnapZoHub__ZeroShares();

        snapToken.burnFrom(user, snapAmount);

        uint256 fromGauge = toFreeShares <= stStaked ? toFreeShares : stStaked;
        if (fromGauge > 0) {
            ISmusdGauge(gauge).withdraw(fromGauge);
        }

        uint256 onHub = IMusdVault(vault).balanceOf(address(this));
        if (onHub < toFreeShares) revert SnapZoHub__InsufficientLiquidity();

        uint256 musdBefore = musd.balanceOf(address(this));
        IMusdVault(vault).withdraw(toFreeShares);
        uint256 musdOut = musd.balanceOf(address(this)) - musdBefore;
        musd.safeTransfer(user, musdOut);

        uint256 mezoOut = mezoGross;
        if (mezoOut > 0) {
            rewardToken.safeTransfer(user, mezoOut);
        }

        _updateReward(user);
        emit Withdraw(user, snapAmount, musdOut, mezoOut, msg.sender);
    }

    function _syncGaugeRewards() internal returns (uint256 delta) {
        uint256 beforeBal = rewardToken.balanceOf(address(this));
        ISmusdGauge(gauge).getReward(address(this));
        delta = rewardToken.balanceOf(address(this)) - beforeBal;
        uint256 u = unallocatedReward;
        uint256 add = _netAfterIndexFee(delta) + u;
        if (add == 0) {
            return 0;
        }
        uint256 ts = snapToken.totalSupply();
        if (ts == 0) {
            unallocatedReward = add;
            return delta;
        }
        unallocatedReward = 0;
        rewardPerTokenStored += add * REWARD_PRECISION / ts;
        return delta;
    }

    /// @dev Fee is realized when rewards are indexed (harvest/sync/manual index), not at user withdraw.
    function _netAfterIndexFee(uint256 amount) internal returns (uint256) {
        if (amount == 0) {
            return 0;
        }
        uint256 currentFeeBps = rewardContract != address(0) ? 2000 : uint256(feeBps);
        uint256 totalFee = (amount * currentFeeBps) / BPS;
        if (totalFee == 0) {
            return amount;
        }
        if (rewardContract != address(0) && currentFeeBps == 2000) {
            uint256 treasuryFee = totalFee / 2; // 10%
            uint256 creatorsFee = totalFee - treasuryFee; // 10%
            if (treasuryFee > 0) {
                rewardToken.safeTransfer(feeReceiver, treasuryFee);
            }
            if (creatorsFee > 0) {
                rewardToken.safeTransfer(rewardContract, creatorsFee);
            }
        } else {
            rewardToken.safeTransfer(feeReceiver, totalFee);
        }
        return amount - totalFee;
    }

    /// @dev If MEZO was claimed while `totalSupply()==0`, merge it on first mint once SNAP exists.
    function _mergeUnallocatedRewards() internal {
        uint256 u = unallocatedReward;
        if (u == 0) {
            return;
        }
        uint256 ts = snapToken.totalSupply();
        if (ts == 0) {
            return;
        }
        unallocatedReward = 0;
        rewardPerTokenStored += u * REWARD_PRECISION / ts;
    }

    function _updateReward(address account) internal {
        if (account == address(0) || account == address(this)) {
            return;
        }
        uint256 bal = snapToken.balanceOf(account);
        uint256 paid = userRewardPerTokenPaid[account];
        if (bal > 0 && rewardPerTokenStored > paid) {
            rewards[account] += (bal * (rewardPerTokenStored - paid)) / REWARD_PRECISION;
        }
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert SnapZoHub__NotRelayer();
        _;
    }

    modifier onlyHarvester() {
        if (msg.sender != owner() && !isRelayer[msg.sender]) revert SnapZoHub__NotHarvester();
        _;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[45] private __gap;
}
