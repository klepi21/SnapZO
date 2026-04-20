// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {SnapZoCreators} from "../src/SnapZoCreators.sol";
import {SnapZoHub} from "../src/SnapZoHub.sol";

contract DeployCreators is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address hubProxy = vm.envAddress("SNAPZO_HUB_ADDRESS");
        address rewardToken = vm.envAddress("MEZO_TOKEN_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        SnapZoCreators creators = new SnapZoCreators(
            vm.addr(deployerPrivateKey), // Owner
            rewardToken,
            relayer
        );

        SnapZoHub hub = SnapZoHub(hubProxy);
        hub.setRewardContract(address(creators));
        hub.setFee(2000, treasury);

        vm.stopBroadcast();
    }
}
