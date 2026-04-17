// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {SnapZoHub} from "../src/SnapZoHub.sol";

/// @notice Upgrade an existing SnapZoHub UUPS proxy to new implementation bytecode.
/// @dev Env: `SNAPZO_HUB_PROXY` — proxy address. `PRIVATE_KEY` — owner (same format as deploy script).
///      Does not change `SnapToken` bytecode; existing SNAP deployments keep prior token logic until a new hub deploy.
contract UpgradeSnapZoHub is Script {
    function run() external {
        uint256 pk = _readPrivateKey();
        address proxyAddr = vm.envAddress("SNAPZO_HUB_PROXY");

        vm.startBroadcast(pk);

        SnapZoHub newImpl = new SnapZoHub();
        UUPSUpgradeable(payable(proxyAddr)).upgradeToAndCall(address(newImpl), "");

        vm.stopBroadcast();

        console2.log("SnapZoHub proxy:", proxyAddr);
        console2.log("New implementation:", address(newImpl));
    }

    function _readPrivateKey() private view returns (uint256) {
        string memory s = vm.envString("PRIVATE_KEY");
        bytes memory b = bytes(s);
        if (b.length == 0) revert("UpgradeSnapZoHub: PRIVATE_KEY empty");
        bool has0x = b.length >= 2 && b[0] == bytes1(hex"30") && (b[1] == bytes1(hex"78") || b[1] == bytes1(hex"58"));
        if (!has0x) {
            s = string.concat("0x", s);
        }
        return vm.parseUint(s);
    }
}
