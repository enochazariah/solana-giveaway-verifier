"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { AnchorProvider, BN, Program, type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "../../idl/solana_giveaway_verifier.json";

const PROGRAM_ID = new PublicKey("4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm");
const RPC = process.env.NEXT_PUBLIC_DEVNET_RPC || "https://api.devnet.solana.com";
const EXAMPLE_ID = "1791672139904";
const enc = new TextEncoder();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function lookup(
  idStr: string,
  onRetry: (n: number) => void
): Promise<Result | "notfound"> {
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

  const giveawayId = new BN(idStr);
  const [giveaway] = PublicKey.findProgramAddressSync(
    [enc.encode("giveaway"), new Uint8Array(giveawayId.toArray("le", 8))],
    PROGRAM_ID
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [enc.encode("vault"), giveaway.toBytes()],
    PROGRAM_ID
  );

  let lastErr: any = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const acc = await program.account.giveaway.fetch(giveaway);
      const vaultLamports = await connection.getBalance(vault);
      const statusKey = Object.keys(acc.status)[0];
      const labels: Record<string, string> = {
        funded: "Funded",
        winnerDeclared: "Winner declared",
        paid: "Paid",
        refunded: "Refunded",
      };
      return {
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
      };
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const missing = /does not exist|could not find|not found/i.test(msg);
      if (missing && attempt >= 3) return "notfound";
      if (attempt < 4) {
        onRetry(attempt);
        await sleep(1500 * attempt);
      }
    }
  }
  throw lastErr ?? new Error("Devnet did not respond");
}

export default function VerifyPage() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function verify(raw?: string) {
    const value = (raw ?? id).trim();
    setError("");
    setNote("");
    setResult(null);
    if (!/^\d{1,19}$/.test(value)) {
      setError("Enter the giveaway ID as digits only.");
      return;
    }
    setLoading(true);
    try {
      const r = await lookup(value, (n) =>
        setNote(`Devnet is busy. Retrying (${n} of 3)...`)
      );
      if (r === "notfound") {
        setError(
          `No giveaway with ID ${value} exists on Devnet. Check the digits, or try the example giveaway.`
        );
      } else {
        setResult(r);
      }
    } catch {
      setError(
        "Could not reach Solana Devnet right now. Wait a few seconds and click Verify again."
      );
    } finally {
      setNote("");
      setLoading(false);
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("id");
    if (q && /^\d{1,19}$/.test(q)) {
      setId(q);
      verify(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          onKeyDown={(e) => {
            if (e.key === "Enter") verify();
          }}
          placeholder="Giveaway ID"
          autoComplete="off"
          className="flex-1 rounded border border-white/20 bg-transparent p-2"
        />
        <button
          onClick={() => verify()}
          disabled={loading}
          className="rounded bg-emerald-500 px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          {loading ? "Checking..." : "Verify"}
        </button>
      </div>

      <button
        onClick={() => {
          setId(EXAMPLE_ID);
          verify(EXAMPLE_ID);
        }}
        disabled={loading}
        className="mt-3 text-sm text-emerald-400 underline disabled:opacity-50"
      >
        Try the example giveaway (already paid out)
      </button>

      {note && <p className="mt-4 text-sm text-white/70">{note}</p>}
      {error && <p className="mt-4 text-red-400">{error}</p>}

      {result && (
        <div className="mt-6 rounded border border-white/10 p-4">
          {row("Title", result.title)}
          {row("Status", result.status)}
          {row("Prize (SOL)", result.prize)}
          {row("Paid out (SOL)", result.paid)}
          {row("Vault balance (SOL)", result.vaultBalance)}
          {row("Ended at", result.endAt)}
          {row(
            "Winner",
            result.winner,
            result.winner.length > 30 ? explorer(result.winner) : undefined
          )}
          {row("Organizer", result.organizer, explorer(result.organizer))}
          {row("Giveaway account", result.giveaway, explorer(result.giveaway))}
          {row("Vault account", result.vault, explorer(result.vault))}
        </div>
      )}

      <div className="mt-10 border-t border-white/10 pt-4 text-sm text-white/70">
        <p>
          Want to create your own giveaway? Open the{" "}
          <a href="/manage" className="text-emerald-400 underline">
            organizer page
          </a>
          . It runs on Solana Devnet. In Solflare, go to Settings, then
          Network, and choose Devnet. Get free test SOL at{" "}
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 underline"
          >
            faucet.solana.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
