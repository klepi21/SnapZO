// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {MockERC20} from "./Mocks.sol";
import {SnapZoCreators} from "../src/SnapZoCreators.sol";

contract SnapZoCreatorsTest is Test {
    MockERC20 internal mezo;
    SnapZoCreators internal creators;

    address internal owner = address(0xA11CE);
    address internal relayer = address(0xB0B);
    address internal alice = address(0xCAFE);
    address internal bob = address(0xD00D);

    function setUp() external {
        mezo = new MockERC20("MEZO", "MEZO");
        creators = new SnapZoCreators(owner, address(mezo), relayer);
        mezo.mint(address(creators), 1_000_000e18);
    }

    function test_setAllocations_and_claim_transfersFullAmount() external {
        address[] memory users = new address[](1);
        users[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 120e18;

        vm.prank(owner);
        creators.setAllocations(users, amounts, false);

        assertEq(creators.claimable(alice), 120e18);

        vm.prank(alice);
        creators.claim();

        assertEq(creators.claimable(alice), 0);
        assertEq(creators.claimed(alice), 120e18);
        assertEq(mezo.balanceOf(alice), 120e18);
    }

    function test_setAllocationsByBps_splitsPoolWithExactBpsSum() external {
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        uint256[] memory bps = new uint256[](2);
        bps[0] = 7000;
        bps[1] = 3000;

        vm.prank(relayer);
        creators.setAllocationsByBps(users, bps, 100e18, true);

        assertEq(creators.claimable(alice), 70e18);
        assertEq(creators.claimable(bob), 30e18);
    }

    function test_setAllocationsByBps_revertsWhenBpsNot10000() external {
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        uint256[] memory bps = new uint256[](2);
        bps[0] = 6000;
        bps[1] = 3000;

        vm.prank(owner);
        vm.expectRevert(SnapZoCreators.SnapZoCreators__InvalidBps.selector);
        creators.setAllocationsByBps(users, bps, 100e18, false);
    }

    function test_claim_revertsWhenNothingClaimable() external {
        vm.prank(alice);
        vm.expectRevert(SnapZoCreators.SnapZoCreators__ZeroClaim.selector);
        creators.claim();
    }
}
