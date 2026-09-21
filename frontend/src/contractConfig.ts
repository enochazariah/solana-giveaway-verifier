export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function totalDonations() view returns (uint256)",
  "function donationsByAddress(address) view returns (uint256)",
  "function donate() payable",
  "function withdraw()",
  "event DonationReceived(address indexed donor, uint256 amount)",
  "event FundsWithdrawn(address indexed owner, uint256 amount)"
];