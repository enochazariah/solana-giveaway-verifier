"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import "@solana/wallet-adapter-react-ui/styles.css";
import { AnchorProvider, BN, Program, type Idl } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../../idl/solana_giveaway_verifier.json";

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const PROGRAM_ID = new PublicKey("4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm");
const RPC = "https://api.devnet.solana.com";
const enc = new TextEncoder();

function pdas(id: BN) {
  const [giveaway] = PublicKey.findProgramAddressSync(
    [enc.encode("giveaway"), new Uint8Array(id.toArray("le", 8))],
    PROGRAM_ID
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [enc.encode("vault"), giveaway.toBytes()],
    PROGRAM_ID
  );
  return { giveaway, vault };
}

function toLamports(s: string): BN | null {
  const t = s.trim();
  if (!/^\d+(\.\d{1,9})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const bn = new BN(whole + frac.padEnd(9, "0"));
  return bn.isZero() ? null : bn;
}

const sol = (l: any) => (Number(l.toString()) / 1e9).toString();
const labels: Record<string, string> = {
  funded: "Funded",
  winnerDeclared: "Winner declared",
  paid: "Paid",
  refunded: "Refunded",
};

const input =
  "w-full rounded border border-neutral-300 bg-white p-2 text-neutral-900";
const btn =
  "rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50";

export default function ManagePage() {
  const wallet = useAnchorWallet();
  const [title, setTitle] = useState("Demo giveaway");
  const [prize, setPrize] = useState("");
  const [minutes, setMinutes] = useState("");
  const [giveawayId, setGiveawayId] = useState("");
  const [winner, setWinner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [txs, setTxs] = useState<{ label: string; sig: string }[]>([]);
  const [info, setInfo] = useState<any>(null);

  const program: any = useMemo(() => {
    const connection = new Connection(RPC, "confirmed");
    const w: any = wallet ?? {
      publicKey: Keypair.generate().publicKey,
      signTransaction: async () => {
        throw new Error("Connect Solflare first.");
      },
      signAllTransactions: async () => {
        throw new Error("Connect Solflare first.");
      },
    };
    return new Program(
      idl as Idl,
      new AnchorProvider(connection, w, { commitment: "confirmed" })
    );
  }, [wallet]);

  async function refresh(idStr: string) {
    const { giveaway, vault } = pdas(new BN(idStr));
    const acc = await program.account.giveaway.fetch(giveaway);
    const bal = await program.provider.connection.getBalance(vault);
    const key = Object.keys(acc.status)[0];
    setInfo({
      status: labels[key] ?? key,
      prize: sol(acc.prizeLamports),
      vault: sol(bal),
      winner: acc.winner ? acc.winner.toBase58() : "Not declared yet",
      endAt: new Date(Number(acc.endAt.toString()) * 1000).toLocaleString(),
    });
  }

  async function run(label: string, idStr: string, action: () => Promise<string>) {
    setError("");
    setBusy(true);
    try {
      if (!wallet) throw new Error("Connect Solflare first.");
      const sig = await action();
      setTxs((t) => [{ label, sig }, ...t]);
      try {
        await refresh(idStr);
      } catch {}
    } catch (e: any) {
      setError(
        (e?.message ?? "Transaction failed") +
          " (Check that Solflare is on Devnet and has Devnet SOL.)"
      );
    } finally {
      setBusy(false);
    }
  }

  function create() {
    const lamports = toLamports(prize);
    if (!lamports) return setError("Enter a valid prize in SOL, like 0.01.");
    if (!title.trim() || enc.encode(title.trim()).length > 80)
      return setError("Title must be 1 to 80 bytes.");
    const mins = Number(minutes);
    if (!(mins > 0)) return setError("End time must be more than 0 minutes.");
    const id = new BN(Date.now().toString());
    const idStr = id.toString();
    const endAt = new BN(Math.floor(Date.now() / 1000) + Math.round(mins * 60));
    setGiveawayId(idStr);
    setInfo(null);
    run("Create and fund", idStr, async () => {
      const { giveaway, vault } = pdas(id);
      return program.methods
        .createAndFund(id, title.trim(), lamports, endAt)
        .accountsPartial({
          organizer: wallet!.publicKey,
          giveaway,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });
  }

  function withId(label: string, fn: (id: BN, idStr: string) => Promise<string>) {
    const idStr = giveawayId.trim();
    if (!/^\d+$/.test(idStr)) return setError("Enter the giveaway ID (digits only).");
    run(label, idStr, () => fn(new BN(idStr), idStr));
  }

  const declare = () =>
    withId("Declare winner", async (id) => {
      if (!winner.trim()) throw new Error("Paste the winner wallet address first.");
      const { giveaway } = pdas(id);
      return program.methods
        .declareWinner(new PublicKey(winner.trim()))
        .accountsPartial({ organizer: wallet!.publicKey, giveaway })
        .rpc();
    });

  const pay = () =>
    withId("Pay winner", async (id) => {
      if (!winner.trim()) throw new Error("Paste the winner wallet address first.");
      const { giveaway, vault } = pdas(id);
      return program.methods
        .payWinner()
        .accountsPartial({
          giveaway,
          vault,
          winner: new PublicKey(winner.trim()),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  const cancel = () =>
    withId("Cancel and refund", async (id) => {
      const { giveaway, vault } = pdas(id);
      return program.methods
        .cancelAndRefund()
        .accountsPartial({
          giveaway,
          vault,
          organizer: wallet!.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

  return (
    <main className="min-h-screen bg-neutral-50 p-6 text-neutral-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Organizer panel (Devnet)</h1>
          <WalletMultiButton />
        </div>

        <section className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">1. Create and fund</h2>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <div className="flex gap-2">
            <input className={input} value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Prize (SOL)" />
            <input className={input} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Ends in (minutes)" />
          </div>
          <button className={btn} disabled={busy} onClick={create}>
            {busy ? "Working..." : "Create and fund"}
          </button>
        </section>

        <section className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">2. Declare, pay, or refund</h2>
          <input className={input} value={giveawayId} onChange={(e) => setGiveawayId(e.target.value)} placeholder="Giveaway ID" />
          <input className={input} value={winner} onChange={(e) => setWinner(e.target.value)} placeholder="Winner wallet address" />
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy} onClick={declare}>Declare winner</button>
            <button className={btn} disabled={busy} onClick={pay}>Pay winner</button>
            <button className={btn} disabled={busy} onClick={cancel}>Cancel and refund</button>
            <button
              className="rounded border border-neutral-300 px-4 py-2"
              disabled={busy}
              onClick={() =>
                refresh(giveawayId.trim()).catch(() => setError("Giveaway not found."))
              }
            >
              Refresh status
            </button>
          </div>
          <p className="text-sm text-neutral-600">
            Declaring a winner only works after the end time.
          </p>
        </section>

        {error && <p className="text-red-600">{error}</p>}

        {info && (
          <section className="rounded border border-neutral-200 bg-white p-4 text-sm">
            <p><b>Status:</b> {info.status}</p>
            <p><b>Prize (SOL):</b> {info.prize}</p>
            <p><b>Vault balance (SOL):</b> {info.vault}</p>
            <p><b>Ends:</b> {info.endAt}</p>
            <p className="break-all"><b>Winner:</b> {info.winner}</p>
          </section>
        )}

        {txs.length > 0 && (
          <section className="rounded border border-neutral-200 bg-white p-4 text-sm">
            <h2 className="mb-2 font-semibold">Transactions</h2>
            {txs.map((t) => (
              <p key={t.sig} className="break-all">
                {t.label}:{" "}
                <a
                  className="text-emerald-700 underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://explorer.solana.com/tx/${t.sig}?cluster=devnet`}
                >
                  {t.sig.slice(0, 20)}...
                </a>
              </p>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
