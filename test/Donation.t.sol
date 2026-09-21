// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Donation} from "../src/Donation.sol";

contract DonationTest is Test {
    Donation public donationContract;

    address owner = address(1);
    address donor = address(2);

    function setUp() public {
        vm.startPrank(owner);
        donationContract = new Donation();
        vm.stopPrank();
    }

    function test_SuccessfulDonation() public {
        vm.startPrank(donor);
        vm.deal(donor, 10 ether);

        donationContract.donate{value: 1 ether}();

        assertEq(donationContract.totalDonations(), 1 ether);
        assertEq(donationContract.donationsByAddress(donor), 1 ether);

        vm.stopPrank();
    }

    function test_WithdrawalByOwner() public {
        vm.deal(donor, 2 ether);
        vm.prank(donor);
        donationContract.donate{value: 2 ether}();

        vm.prank(owner);
        donationContract.withdraw();

        assertEq(address(donationContract).balance, 0);
        assertEq(owner.balance, 2 ether);
    }

    function test_RevertIfNonOwnerWithdraws() public {
        vm.expectRevert("Only owner can withdraw");

        vm.prank(donor);
        donationContract.withdraw();
    }
}