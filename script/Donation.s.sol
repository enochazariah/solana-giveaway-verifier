// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {Donation} from "../src/Donation.sol";

contract DonationScript is Script {
    function run() external {
        vm.startBroadcast();
        new Donation();
        vm.stopBroadcast();
    }
}