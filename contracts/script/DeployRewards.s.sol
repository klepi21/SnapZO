// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {SnapZoRewards} from "../src/SnapZoRewards.sol";
import {SnapZoHub} from "../src/SnapZoHub.sol";

contract DeployRewards is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address hubProxy = vm.envAddress("SNAPZO_HUB_ADDRESS");
        address rewardToken = vm.envAddress("MEZO_TOKEN_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Rewards Contract
        SnapZoRewards rewards = new SnapZoRewards(
            vm.addr(deployerPrivateKey), // Owner
            rewardToken,
            relayer
        );

        // 2. Link Hub to Rewards
        SnapZoHub hub = SnapZoHub(hubProxy);
        hub.setRewardContract(address(rewards));
        
        // 3. Ensure fee receiver is treasury
        hub.setFee(2000, treasury);

        vm.stopBroadcast();
    }
}
