// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SnapZoSocial} from "../src/SnapZoSocial.sol";
import {MockERC20} from "./Mocks.sol";

contract SnapZoSocialTest is Test {
    SnapZoSocial internal social;
    MockERC20 internal snap;

    address internal owner = address(this);
    uint256 internal alicePk = 0xA11CE;
    uint256 internal bobPk = 0xB0B;
    uint256 internal carolPk = 0xCA801;
    address internal alice;
    address internal bob;
    address internal carol;
    address internal relayer = address(0xBEEF);

    bytes32 internal constant TIP_TYPEHASH =
        keccak256("Tip(address tipper,uint256 postId,address creator,uint256 nonce,uint256 deadline)");
    bytes32 internal constant UNLOCK_TYPEHASH = keccak256(
        "Unlock(address unlocker,uint256 postId,address creator,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant REPLY_DEPOSIT_TYPEHASH = keccak256(
        "ReplyDeposit(address payer,uint256 postId,address creator,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant FULFILL_TYPEHASH = keccak256(
        "FulfillReply(address creator,bytes32 requestId,uint256 commentId,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant REFUND_TYPEHASH =
        keccak256("RefundReply(address requester,bytes32 requestId,uint256 nonce,uint256 deadline)");

    function setUp() public {
        alice = vm.addr(alicePk);
        bob = vm.addr(bobPk);
        carol = vm.addr(carolPk);

        snap = new MockERC20("SNAP", "SNAP");

        address[] memory relayers = new address[](1);
        relayers[0] = relayer;

        SnapZoSocial impl = new SnapZoSocial();
        bytes memory init = abi.encodeCall(
            SnapZoSocial.initialize,
            (owner, IERC20(address(snap)), 1 ether, 2 ether, relayers)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        social = SnapZoSocial(address(proxy));

        snap.mint(alice, 100 ether);
        snap.mint(bob, 100 ether);
        vm.prank(alice);
        snap.approve(address(social), type(uint256).max);
        vm.prank(bob);
        snap.approve(address(social), type(uint256).max);
    }

    function _hashTyped(SnapZoSocial s, bytes32 structHash) internal view returns (bytes32) {
        bytes32 ds = s.domainSeparatorV4();
        return keccak256(abi.encodePacked("\x19\x01", ds, structHash));
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testTipWithSig_transfersToCreator() public {
        uint256 postId = 42;
        uint256 deadline = block.timestamp + 1 days;
        bytes32 sh = keccak256(abi.encode(TIP_TYPEHASH, alice, postId, bob, uint256(0), deadline));
        bytes memory sig = _sign(alicePk, _hashTyped(social, sh));

        uint256 bobBefore = snap.balanceOf(bob);
        vm.prank(relayer);
        social.tipWithSig(alice, postId, bob, 0, deadline, sig);

        assertEq(snap.balanceOf(bob), bobBefore + 1 ether);
        assertEq(social.nonces(alice), 1);
    }

    function testUnlockWithSig_exactAmount() public {
        uint256 postId = 7;
        uint256 amount = 5 ether;
        uint256 deadline = block.timestamp + 1 days;
        bytes32 sh = keccak256(abi.encode(UNLOCK_TYPEHASH, alice, postId, bob, amount, uint256(0), deadline));
        bytes memory sig = _sign(alicePk, _hashTyped(social, sh));

        vm.prank(relayer);
        social.unlockWithSig(alice, postId, bob, amount, 0, deadline, sig);

        assertEq(snap.balanceOf(bob), 100 ether + 5 ether);
    }

    function testReplyDeposit_fulfill_refund() public {
        uint256 postId = 99;
        uint256 d1 = block.timestamp + 1 days;
        bytes32 shD = keccak256(abi.encode(REPLY_DEPOSIT_TYPEHASH, alice, postId, bob, uint256(0), d1));
        bytes memory sigD = _sign(alicePk, _hashTyped(social, shD));

        vm.prank(relayer);
        social.replyDepositWithSig(alice, postId, bob, 0, d1, sigD);

        bytes32 requestId =
            keccak256(abi.encode(block.chainid, address(social), postId, bob, alice, uint256(0)));
        assertEq(snap.balanceOf(address(social)), 2 ether);

        uint256 d2 = block.timestamp + 2 days;
        bytes32 shF = keccak256(abi.encode(FULFILL_TYPEHASH, bob, requestId, uint256(123), uint256(0), d2));
        bytes memory sigF = _sign(bobPk, _hashTyped(social, shF));

        vm.prank(relayer);
        social.fulfillReplyWithSig(bob, requestId, 123, 0, d2, sigF);

        assertEq(snap.balanceOf(bob), 100 ether + 2 ether);
        assertEq(snap.balanceOf(address(social)), 0);

        // Second path: new deposit from alice, warp, refund
        snap.mint(alice, 10 ether);
        uint256 d3 = block.timestamp + 3 days;
        bytes32 shD2 = keccak256(abi.encode(REPLY_DEPOSIT_TYPEHASH, alice, postId, bob, uint256(1), d3));
        bytes memory sigD2 = _sign(alicePk, _hashTyped(social, shD2));

        vm.prank(relayer);
        social.replyDepositWithSig(alice, postId, bob, 1, d3, sigD2);

        bytes32 requestId2 =
            keccak256(abi.encode(block.chainid, address(social), postId, bob, alice, uint256(1)));
        assertEq(snap.balanceOf(address(social)), 2 ether);

        (, , , , uint48 refundOpen,) = social.replyLocks(requestId2);
        vm.warp(refundOpen + 1);

        uint256 d4 = block.timestamp + 1 days;
        bytes32 shR = keccak256(abi.encode(REFUND_TYPEHASH, alice, requestId2, uint256(2), d4));
        bytes memory sigR = _sign(alicePk, _hashTyped(social, shR));

        vm.prank(relayer);
        social.refundReplyWithSig(alice, requestId2, 2, d4, sigR);

        // 100 - 2 (dep1) + 10 mint - 2 (dep2) + 2 (refund) = 108
        assertEq(snap.balanceOf(alice), 108 ether);
        assertEq(snap.balanceOf(address(social)), 0);
    }

    function testNonRelayerReverts() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes32 sh = keccak256(abi.encode(TIP_TYPEHASH, alice, uint256(1), bob, uint256(0), deadline));
        bytes memory sig = _sign(alicePk, _hashTyped(social, sh));

        address notRelayer = address(0x1234);
        vm.expectRevert(SnapZoSocial.SnapZoSocial__NotRelayer.selector);
        vm.prank(notRelayer);
        social.tipWithSig(alice, 1, bob, 0, deadline, sig);
    }
}
