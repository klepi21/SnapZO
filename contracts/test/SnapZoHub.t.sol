// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SnapZoHub} from "../src/SnapZoHub.sol";
import {MockERC20, MockGauge, MockVault} from "./Mocks.sol";

contract SnapZoHubTest is Test {
    SnapZoHub internal hub;
    MockERC20 internal musd;
    MockERC20 internal reward;
    MockVault internal vault;
    MockGauge internal gauge;

    address internal owner = address(this);
    uint256 internal alicePk = 0xA11CE;
    address internal alice;
    address internal relayer = address(0xBEEF);

    bytes32 internal constant DEPOSIT_TYPEHASH =
        keccak256("Deposit(address user,uint256 assets,uint256 nonce,uint256 deadline)");
    bytes32 internal constant WITHDRAW_TYPEHASH =
        keccak256("Withdraw(address user,uint256 snapAmount,uint256 nonce,uint256 deadline)");

    function setUp() public {
        alice = vm.addr(alicePk);
        musd = new MockERC20("MUSD", "MUSD");
        reward = new MockERC20("REWARD", "RWD");
        vault = new MockVault(IERC20(musd));
        gauge = new MockGauge(IERC20(vault), IERC20(reward));

        address[] memory relayers = new address[](1);
        relayers[0] = relayer;

        SnapZoHub impl = new SnapZoHub();
        bytes memory init = abi.encodeCall(
            SnapZoHub.initialize,
            (
                owner,
                IERC20(musd),
                address(vault),
                address(gauge),
                address(0),
                IERC20(address(reward)),
                owner,
                uint16(1000),
                relayers
            )
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        hub = SnapZoHub(address(proxy));

        musd.mint(alice, 100 ether);
        vm.prank(alice);
        musd.approve(address(hub), type(uint256).max);
    }

    function _signDeposit(address user, uint256 pk, uint256 assets, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 ds = hub.domainSeparatorV4();
        bytes32 structHash = keccak256(abi.encode(DEPOSIT_TYPEHASH, user, assets, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", ds, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signWithdraw(address user, uint256 pk, uint256 snapAmt, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 ds = hub.domainSeparatorV4();
        bytes32 structHash = keccak256(abi.encode(WITHDRAW_TYPEHASH, user, snapAmt, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", ds, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testDepositWithSig_mintsSnapAndStakes() public {
        uint256 assets = 10 ether;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signDeposit(alice, alicePk, assets, 0, deadline);

        vm.prank(relayer);
        hub.depositWithSig(alice, assets, 0, deadline, sig);

        assertEq(hub.snapToken().balanceOf(alice), assets);
        assertEq(gauge.balanceOf(address(hub)), assets);
        assertEq(musd.balanceOf(alice), 100 ether - assets);
    }

    function testWithdrawWithSig_returnsMusd() public {
        uint256 assets = 10 ether;
        uint256 d1 = block.timestamp + 1 days;
        vm.prank(relayer);
        hub.depositWithSig(alice, assets, 0, d1, _signDeposit(alice, alicePk, assets, 0, d1));

        uint256 snap = hub.snapToken().balanceOf(alice);
        uint256 d2 = block.timestamp + 2 days;
        bytes memory sigW = _signWithdraw(alice, alicePk, snap, 1, d2);

        vm.prank(relayer);
        hub.withdrawWithSig(alice, snap, 1, d2, sigW);

        assertEq(hub.snapToken().balanceOf(alice), 0);
        assertEq(musd.balanceOf(alice), 100 ether);
    }

    function testHarvest_transfersRewardAndFee() public {
        reward.mint(address(gauge), 10 ether);

        uint256 assets = 5 ether;
        uint256 d1 = block.timestamp + 1 days;
        vm.prank(relayer);
        hub.depositWithSig(alice, assets, 0, d1, _signDeposit(alice, alicePk, assets, 0, d1));

        vm.prank(relayer);
        hub.harvest();

        assertEq(reward.balanceOf(address(hub)), 9 ether, "hub reward after 10% fee");
        assertEq(reward.balanceOf(owner), 1 ether, "treasury fee");
    }

    function testRestake_depositsIdleMusd() public {
        musd.mint(address(hub), 3 ether);
        vm.prank(relayer);
        hub.restake();
        assertEq(gauge.balanceOf(address(hub)), 3 ether);
    }

    function testPause_blocksDeposit() public {
        hub.pause();
        uint256 assets = 10 ether;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signDeposit(alice, alicePk, assets, 0, deadline);
        vm.prank(relayer);
        vm.expectRevert();
        hub.depositWithSig(alice, assets, 0, deadline, sig);
    }

    function testRecoverAndInject_manualRewardLoop() public {
        reward.mint(address(hub), 5 ether);
        uint256 snapBefore = hub.snapToken().totalSupply();
        hub.recoverRewardToken(owner, 5 ether);
        assertEq(reward.balanceOf(owner), 5 ether);

        musd.mint(owner, 2 ether);
        vm.startPrank(owner);
        musd.approve(address(hub), 2 ether);
        hub.injectMusdWithoutMint(2 ether);
        vm.stopPrank();

        assertEq(hub.snapToken().totalSupply(), snapBefore);
        assertEq(gauge.balanceOf(address(hub)), 2 ether);
    }
}
