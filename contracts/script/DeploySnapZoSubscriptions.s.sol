// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SnapZoSubscriptions} from "../src/SnapZoSubscriptions.sol";

/// @notice Deploy UUPS proxy + initialize for OnlySnaps subscriptions.
contract DeploySnapZoSubscriptions is Script {
    function run() external {
        uint256 pk = _readPrivateKey();
        address deployer = vm.addr(pk);

        IERC20 snap = IERC20(vm.envAddress("SNAP_TOKEN"));
        address[] memory relayers = new address[](1);
        relayers[0] = vm.envOr("RELAYER", deployer);

        vm.startBroadcast(pk);

        SnapZoSubscriptions impl = new SnapZoSubscriptions();
        bytes memory init = abi.encodeCall(SnapZoSubscriptions.initialize, (deployer, snap, relayers));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        SnapZoSubscriptions subscriptions = SnapZoSubscriptions(address(proxy));

        vm.stopBroadcast();

        console2.log("SnapZoSubscriptions implementation:", address(impl));
        console2.log("SnapZoSubscriptions proxy (app address):", address(subscriptions));
    }

    function _readPrivateKey() private view returns (uint256) {
        string memory s = vm.envString("PRIVATE_KEY");
        bytes memory b = bytes(s);
        if (b.length == 0) revert("DeploySnapZoSubscriptions: PRIVATE_KEY empty");
        bool has0x = b.length >= 2 && b[0] == bytes1(hex"30") && (b[1] == bytes1(hex"78") || b[1] == bytes1(hex"58"));
        if (!has0x) {
            s = string.concat("0x", s);
        }
        return vm.parseUint(s);
    }
}
