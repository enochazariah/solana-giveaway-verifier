"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import confetti from "canvas-confetti";
import { Wallet, Heart, ArrowUpRight, ShieldCheck, RefreshCw } from "lucide-react";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../contractConfig";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Home() {
  const [account, setAccount] = useState<string>("");
  const [totalDonations, setTotalDonations] = useState<string>("0");
  const [userDonations, setUserDonations] = useState<string>("0");
  const [donationAmount, setDonationAmount] = useState<string>("");
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const loadContractData = useCallback(async (userAddress?: string) => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const totalRaw = await contract.totalDonations();
      setTotalDonations(ethers.formatEther(totalRaw));

      const contractOwner = await contract.owner();
      const currentAddr = userAddress || account;

      if (currentAddr) {
        setIsOwner(currentAddr.toLowerCase() === contractOwner.toLowerCase());
        const userRaw = await contract.donationsByAddress(currentAddr);
        setUserDonations(ethers.formatEther(userRaw));
      }
    } catch (err) {
      console.error("Error fetching contract data:", err);
    }
  }, [account]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use this app!");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await loadContractData(accounts[0]);
      }
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donationAmount || parseFloat(donationAmount) <= 0) return;
    if (!window.ethereum) return;

    try {
      setLoading(true);
      setStatusMsg("Confirming transaction in MetaMask...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.donate({
        value: ethers.parseEther(donationAmount),
      });

      setStatusMsg("Mining transaction on local blockchain...");
      await tx.wait();

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setStatusMsg("Thank you for your donation!");
      setDonationAmount("");
      await loadContractData();
    } catch (err: any) {
      console.error("Donation error:", err);
      setStatusMsg(err?.reason || "Donation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!window.ethereum) return;
    try {
      setLoading(true);
      setStatusMsg("Initiating withdrawal...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.withdraw();
      setStatusMsg("Mining withdrawal transaction...");
      await tx.wait();

      setStatusMsg("Funds successfully withdrawn!");
      await loadContractData();
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      setStatusMsg(err?.reason || "Withdrawal failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContractData();
  }, [loadContractData]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6 sm:p-12">
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center pb-8 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
          <h1 className="text-2xl font-bold tracking-tight">EthGive</h1>
        </div>
        <button
          onClick={connectWallet}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium px-4 py-2 rounded-xl border border-slate-700 transition"
        >
          <Wallet className="w-4 h-4 text-emerald-400" />
          {account
            ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}`
            : "Connect Wallet"}
        </button>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
        {/* Stats Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Total Raised
            </span>
            <div className="text-4xl font-extrabold text-white mt-2 flex items-baseline gap-2">
              {totalDonations} <span className="text-lg text-emerald-400 font-bold">ETH</span>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Directly secured on the Ethereum smart contract.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-400">Your Contributions</span>
              <p className="text-xl font-bold text-slate-200">{userDonations} ETH</p>
            </div>
            <button
              onClick={() => loadContractData()}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold">Make a Donation</h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter the amount of local ETH you wish to donate.
            </p>

            <form onSubmit={handleDonate} className="mt-6 flex flex-col gap-4">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  placeholder="0.1"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  disabled={loading}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-lg"
                  required
                />
                <span className="absolute right-4 top-3.5 text-sm font-bold text-slate-400">
                  ETH
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || !account}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
              >
                {loading ? "Processing..." : "Donate Now"}
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Owner Dashboard */}
          {isOwner && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                <ShieldCheck className="w-4 h-4" /> Owner Controls
              </div>
              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 font-medium py-2 rounded-xl text-sm transition"
              >
                Withdraw Contract Funds
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Message */}
      {statusMsg && (
        <div className="mt-6 bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium">
          {statusMsg}
        </div>
      )}
    </main>
  );
}