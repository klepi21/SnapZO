// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SnapZoSubscriptions} from "../src/SnapZoSubscriptions.sol";
import {MockERC20} from "./Mocks.sol";

contract SnapZoSubscriptionsTest is Test {
    SnapZoSubscriptions internal subscriptions;
    MockERC20 internal snap;

    address internal owner = address(this);
    uint256 internal alicePk = 0xA11CE;
    uint256 internal bobPk = 0xB0B;
    address internal alice;
    address internal bob;
    address internal relayer = address(0xBEEF);

    bytes32 internal constant SUBSCRIBE_TYPEHASH =
        keccak256("Subscribe(address subscriber,address creator,uint256 amount,uint256 nonce,uint256 deadline)");

    function setUp() public {
        alice = vm.addr(alicePk);
        bob = vm.addr(bobPk);

        snap = new MockERC20("SNAP", "SNAP");

        address[] memory relayers = new address[](1);
        relayers[0] = relayer;

        SnapZoSubscriptions impl = new SnapZoSubscriptions();
        bytes memory init = abi.encodeCall(SnapZoSubscriptions.initialize, (owner, IERC20(address(snap)), relayers));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        subscriptions = SnapZoSubscriptions(address(proxy));

        snap.mint(alice, 1000 ether);
        vm.prank(alice);
        snap.approve(address(subscriptions), type(uint256).max);

        vm.prank(bob);
        subscriptions.setMonthlyPrice(1 ether);
    }

    function _hashTyped(bytes32 structHash) internal view returns (bytes32) {
        bytes32 ds = subscriptions.domainSeparatorV4();
        return keccak256(abi.encodePacked("\x19\x01", ds, structHash));
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _subscribeSig(uint256 nonce, uint256 deadline, uint256 amount) internal view returns (bytes memory) {
        bytes32 sh = keccak256(abi.encode(SUBSCRIBE_TYPEHASH, alice, bob, amount, nonce, deadline));
        return _sign(alicePk, _hashTyped(sh));
    }

    function testSubscribeWithSig_transfersAndSetsExpiry() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _subscribeSig(0, deadline, 1 ether);

        uint256 bobBefore = snap.balanceOf(bob);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 0, deadline, sig);

        assertEq(snap.balanceOf(bob), bobBefore + 1 ether);
        assertEq(subscriptions.nonces(alice), 1);
        assertTrue(subscriptions.expiresAt(bob, alice) > block.timestamp);
        assertTrue(subscriptions.hasActiveSubscription(bob, alice));
    }

    function testRenewBeforeExpiry_extendsFromCurrentExpiry() public {
        uint256 d1 = block.timestamp + 1 days;
        bytes memory s1 = _subscribeSig(0, d1, 1 ether);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 0, d1, s1);

        uint48 firstExpiry = subscriptions.expiresAt(bob, alice);
        vm.warp(block.timestamp + 3 days);

        uint256 d2 = block.timestamp + 1 days;
        bytes memory s2 = _subscribeSig(1, d2, 1 ether);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 1, d2, s2);

        uint48 secondExpiry = subscriptions.expiresAt(bob, alice);
        assertEq(secondExpiry, firstExpiry + uint48(subscriptions.SUBSCRIPTION_PERIOD()));
    }

    function testRenewAfterExpiry_startsFromNow() public {
        uint256 d1 = block.timestamp + 1 days;
        bytes memory s1 = _subscribeSig(0, d1, 1 ether);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 0, d1, s1);

        uint48 firstExpiry = subscriptions.expiresAt(bob, alice);
        vm.warp(firstExpiry + 1);

        uint256 d2 = block.timestamp + 1 days;
        bytes memory s2 = _subscribeSig(1, d2, 1 ether);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 1, d2, s2);

        uint48 secondExpiry = subscriptions.expiresAt(bob, alice);
        assertEq(secondExpiry, uint48(block.timestamp) + uint48(subscriptions.SUBSCRIPTION_PERIOD()));
    }

    function testBadNonceReverts() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _subscribeSig(0, deadline, 1 ether);

        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 0, deadline, sig);

        vm.expectRevert(SnapZoSubscriptions.SnapZoSubscriptions__BadNonce.selector);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 0, deadline, sig);
    }

    function testWrongAmountReverts() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _subscribeSig(0, deadline, 2 ether);

        vm.expectRevert(SnapZoSubscriptions.SnapZoSubscriptions__BadAmount.selector);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, bob, 2 ether, 0, deadline, sig);
    }

    function testPlanNotSetReverts() public {
        address creatorWithoutPlan = address(0xCAFE);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 sh =
            keccak256(abi.encode(SUBSCRIBE_TYPEHASH, alice, creatorWithoutPlan, 1 ether, uint256(0), deadline));
        bytes memory sig = _sign(alicePk, _hashTyped(sh));

        vm.expectRevert(SnapZoSubscriptions.SnapZoSubscriptions__PlanNotSet.selector);
        vm.prank(relayer);
        subscriptions.subscribeWithSig(alice, creatorWithoutPlan, 1 ether, 0, deadline, sig);
    }

    function testNonRelayerReverts() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _subscribeSig(0, deadline, 1 ether);

        vm.expectRevert(SnapZoSubscriptions.SnapZoSubscriptions__NotRelayer.selector);
        vm.prank(address(0x1234));
        subscriptions.subscribeWithSig(alice, bob, 1 ether, 0, deadline, sig);
    }
}
