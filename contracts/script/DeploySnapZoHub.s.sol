// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SnapZoHub} from "../src/SnapZoHub.sol";

/// @notice Deploy UUPS proxy + initialize. `PRIVATE_KEY` may be `0x…` or raw 64-hex (no prefix).
contract DeploySnapZoHub is Script {
    function run() external {
        uint256 pk = _readPrivateKey();
        address deployer = vm.addr(pk);

        address musd = vm.envAddress("MUSD");
        address vault = vm.envAddress("MUSD_VAULT");
        address gauge = vm.envAddress("SMUSD_GAUGE");
        address router = vm.envAddress("SWAP_ROUTER");
        address reward = vm.envAddress("GAUGE_REWARD_TOKEN");
        address feeReceiver = vm.envOr("FEE_RECEIVER", deployer);
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(100)));

        address[] memory relayers = new address[](1);
        relayers[0] = vm.envOr("RELAYER", deployer);

        vm.startBroadcast(pk);

        SnapZoHub impl = new SnapZoHub();
        bytes memory init = abi.encodeCall(
            SnapZoHub.initialize,
            (
                deployer,
                IERC20(musd),
                vault,
                gauge,
                router,
                IERC20(reward),
                feeReceiver,
                feeBps,
                relayers
            )
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        SnapZoHub hub = SnapZoHub(address(proxy));

        vm.stopBroadcast();

        console2.log("SnapZoHub implementation:", address(impl));
        console2.log("SnapZoHub proxy (UI address):", address(hub));
        console2.log("SNAP token:", address(hub.snapToken()));
    }

    function _readPrivateKey() private view returns (uint256) {
        string memory s = vm.envString("PRIVATE_KEY");
        bytes memory b = bytes(s);
        if (b.length == 0) revert("DeploySnapZoHub: PRIVATE_KEY empty");
        bool has0x = b.length >= 2 && b[0] == bytes1(hex"30") && (b[1] == bytes1(hex"78") || b[1] == bytes1(hex"58"));
        if (!has0x) {
            s = string.concat("0x", s);
        }
        return vm.parseUint(s);
    }
}
