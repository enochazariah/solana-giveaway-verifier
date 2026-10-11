"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { AnchorProvider, BN, Program, type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "../../idl/solana_giveaway_verifier.json";

const PROGRAM_ID = new PublicKey("4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm");
const RPC = "https://api.devnet.solana.com";
const enc = new TextEncoder();

const explorer = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=devnet`;
const sol = (lamports: any) => (Number(lamports.toString()) / 1e9).toString();
const when = (unix: any) =>
  new Date(Number(unix.toString()) * 1000).toLocaleString();

type Result = {
  giveaway: string;
  vault: string;
  title: string;
  organizer: string;
  prize: string;
  paid: string;
  status: string;
  winner: string;
  endAt: string;
  vaultBalance: string;
};

export default function VerifyPage() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function verify() {
    setError("");
    setResult(null);
    if (!/^\d+$/.test(id.trim())) {
      setError("Enter the giveaway ID as digits only.");
      return;
    }
    setLoading(true);
    try {
      const connection = new Connection(RPC, "confirmed");
      const dummy = Keypair.generate();
      const readOnlyWallet: any = {
        publicKey: dummy.publicKey,
        signTransaction: async () => {
          throw new Error("Read-only");
        },
        signAllTransactions: async () => {
          throw new Error("Read-only");
        },
      };
      const provider = new AnchorProvider(connection, readOnlyWallet, {
        commitment: "confirmed",
      });
      const program: any = new Program(idl as Idl, provider);

      const giveawayId = new BN(id.trim());
      const [giveaway] = PublicKey.findProgramAddressSync(
        [enc.encode("giveaway"), new Uint8Array(giveawayId.toArray("le", 8))],
        PROGRAM_ID
      );
      const [vault] = PublicKey.findProgramAddressSync(
        [enc.encode("vault"), giveaway.toBytes()],
        PROGRAM_ID
      );

      const acc = await program.account.giveaway.fetch(giveaway);
      const vaultLamports = await connection.getBalance(vault);
      const statusKey = Object.keys(acc.status)[0];
      const labels: Record<string, string> = {
        funded: "Funded",
        winnerDeclared: "Winner declared",
        paid: "Paid",
        refunded: "Refunded",
      };

      setResult({
        giveaway: giveaway.toBase58(),
        vault: vault.toBase58(),
        title: acc.title,
        organizer: acc.organizer.toBase58(),
        prize: sol(acc.prizeLamports),
        paid: sol(acc.paidLamports),
        status: labels[statusKey] ?? statusKey,
        winner: acc.winner ? acc.winner.toBase58() : "Not declared yet",
        endAt: when(acc.endAt),
        vaultBalance: sol(vaultLamports),
      });
    } catch {
      setError(
        "No giveaway found for that ID on Devnet. Check the ID and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const row = (label: string, value: string, link?: string) => (
    <div className="flex flex-col gap-1 border-b border-white/10 py-3 sm:flex-row sm:justify-between">
      <span className="text-sm text-white/60">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sm text-emerald-400 underline"
        >
          {value}
        </a>
      ) : (
        <span className="break-all text-sm">{value}</span>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-2xl p-6 text-white">
      <h1 className="text-2xl font-bold">Verify a giveaway</h1>
      <p className="mt-2 text-sm text-white/70">
        Enter a giveaway ID to read its status, winner, and vault balance
        directly from Solana Devnet. No wallet needed.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Giveaway ID"
          autoComplete="off"
          className="flex-1 rounded border border-white/20 bg-transparent p-2"
        />
        <button
          onClick={verify}
          disabled={loading}
          className="rounded bg-emerald-500 px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          {loading ? "Checking..." : "Verify"}
        </button>
      </div>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {result && (
        <div className="mt-6 rounded border border-white/10 p-4">
          {row("Title", result.title)}
          {row("Status", result.status)}
          {row("Prize (SOL)", result.prize)}
          {row("Paid out (SOL)", result.paid)}
          {row("Vault balance (SOL)", result.vaultBalance)}
          {row("Ended at", result.endAt)}
          {row("Winner", result.winner, result.winner.length > 30 ? explorer(result.winner) : undefined)}
          {row("Organizer", result.organizer, explorer(result.organizer))}
          {row("Giveaway account", result.giveaway, explorer(result.giveaway))}
          {row("Vault account", result.vault, explorer(result.vault))}
        </div>
      )}
    </main>
  );
}
