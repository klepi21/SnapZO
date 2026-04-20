// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface ISnapZoHubRepair {
    function repairAfterBadV2Upgrade(address rewardContract_, address[] calldata usersToReset) external;
}

/// @notice Execute one-time repair on a paused SnapZoHub proxy after the bad storage-layout upgrade.
/// @dev Env:
///      - PRIVATE_KEY         (owner)
///      - SNAPZO_HUB_PROXY    (hub proxy)
///      - REWARD_CONTRACT     (SnapZoRewards address)
///      - RESET_USERS_CSV     (optional, comma-separated addresses to clear reward debt/claimable)
contract RepairSnapZoHubState is Script {
    function run() external {
        uint256 pk = _readPrivateKey();
        address hubProxy = vm.envAddress("SNAPZO_HUB_PROXY");
        address rewardContract = vm.envAddress("REWARD_CONTRACT");
        address[] memory users = _readUsersCsv();

        vm.startBroadcast(pk);
        ISnapZoHubRepair(hubProxy).repairAfterBadV2Upgrade(rewardContract, users);
        vm.stopBroadcast();

        console2.log("SnapZoHub proxy:", hubProxy);
        console2.log("Reward contract:", rewardContract);
        console2.log("Users reset:", users.length);
    }

    function _readUsersCsv() private view returns (address[] memory) {
        string memory csv = vm.envOr("RESET_USERS_CSV", string(""));
        bytes memory b = bytes(csv);
        if (b.length == 0) return new address[](0);

        uint256 count = 1;
        for (uint256 i; i < b.length; i++) {
            if (b[i] == bytes1(",")) count++;
        }

        address[] memory out = new address[](count);
        uint256 start = 0;
        uint256 idx = 0;
        for (uint256 i; i <= b.length; i++) {
            if (i == b.length || b[i] == bytes1(",")) {
                bytes memory part = new bytes(i - start);
                for (uint256 j; j < i - start; j++) {
                    part[j] = b[start + j];
                }
                string memory raw = _trim(string(part));
                out[idx] = vm.parseAddress(raw);
                idx++;
                start = i + 1;
            }
        }
        return out;
    }

    function _trim(string memory s) private pure returns (string memory) {
        bytes memory b = bytes(s);
        uint256 i = 0;
        while (i < b.length && b[i] == 0x20) i++;
        uint256 j = b.length;
        while (j > i && b[j - 1] == 0x20) j--;
        bytes memory out = new bytes(j - i);
        for (uint256 k; k < j - i; k++) {
            out[k] = b[i + k];
        }
        return string(out);
    }

    function _readPrivateKey() private view returns (uint256) {
        string memory s = vm.envString("PRIVATE_KEY");
        bytes memory b = bytes(s);
        if (b.length == 0) revert("RepairSnapZoHubState: PRIVATE_KEY empty");
        bool has0x =
            b.length >= 2 && b[0] == bytes1(hex"30") && (b[1] == bytes1(hex"78") || b[1] == bytes1(hex"58"));
        if (!has0x) {
            s = string.concat("0x", s);
        }
        return vm.parseUint(s);
    }
}

