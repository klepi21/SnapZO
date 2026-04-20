// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface ISnapZoHubIndex {
    function indexExistingRewards(uint256 amount) external;
}

/// @notice Index existing reward-token balance already sitting on hub into rewardPerTokenStored.
/// @dev Env:
///      - PRIVATE_KEY
///      - SNAPZO_HUB_PROXY
///      - INDEX_AMOUNT_WEI (reward token base units, 18 dp for MEZO)
contract IndexExistingRewards is Script {
    function run() external {
        uint256 pk = _readPrivateKey();
        address hubProxy = vm.envAddress("SNAPZO_HUB_PROXY");
        uint256 amount = vm.envUint("INDEX_AMOUNT_WEI");

        vm.startBroadcast(pk);
        ISnapZoHubIndex(hubProxy).indexExistingRewards(amount);
        vm.stopBroadcast();

        console2.log("SnapZoHub proxy:", hubProxy);
        console2.log("Indexed reward amount (wei):", amount);
    }

    function _readPrivateKey() private view returns (uint256) {
        string memory s = vm.envString("PRIVATE_KEY");
        bytes memory b = bytes(s);
        if (b.length == 0) revert("IndexExistingRewards: PRIVATE_KEY empty");
        bool has0x =
            b.length >= 2 && b[0] == bytes1(hex"30") && (b[1] == bytes1(hex"78") || b[1] == bytes1(hex"58"));
        if (!has0x) {
            s = string.concat("0x", s);
        }
        return vm.parseUint(s);
    }
}

