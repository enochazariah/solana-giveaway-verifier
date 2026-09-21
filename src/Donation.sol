// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Donation {
    address public owner;
    uint256 public totalDonations;

    mapping(address => uint256) public donationsByAddress;

    event DonationReceived(address indexed donor, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function donate() external payable {
        require(msg.value > 0, "Donation must be greater than zero");

        donationsByAddress[msg.sender] += msg.value;
        totalDonations += msg.value;

        emit DonationReceived(msg.sender, msg.value);
    }

    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds available");

        (bool success, ) = owner.call{value: balance}("");
        require(success, "Transfer failed");

        emit FundsWithdrawn(owner, balance);
    }
}