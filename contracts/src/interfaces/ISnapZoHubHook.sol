// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Called by `SnapToken` on every balance change so the hub can checkpoint MEZO rewards.
interface ISnapZoHubHook {
    function snapTransferHook(address from, address to, uint256 value) external;
}
