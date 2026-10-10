"use client";

import { useState, useSyncExternalStore } from "react";
import { BN } from "@anchor-lang/core";
import { Heart } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../idl/solana_giveaway_verifier.json";
import { SOLANA_GIVEAWAY_PROGRAM_ID, useGiveawayProgram } from "../lib/useGiveawayProgram";

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

type ErrorDetails = {
  name?: string;
  message?: string;
  error?: ErrorDetails;
  cause?: ErrorDetails;
};

function getErrorDetails(error: unknown, seen = new Set<object>()): ErrorDetails {
  if (typeof error !== "object" || error === null) {
    return { message: typeof error === "string" ? error : undefined };
  }
  if (seen.has(error)) return { message: "[Circular error reference]" };

  seen.add(error);
  const details = error as {
    name?: unknown;
    message?: unknown;
    error?: unknown;
    cause?: unknown;
  };
  const result: ErrorDetails = {
    name: typeof details.name === "string" ? details.name : undefined,
    message: typeof details.message === "string" ? details.message : undefined,
  };
  if (details.error !== undefined) result.error = getErrorDetails(details.error, seen);
  if (details.cause !== undefined) result.cause = getErrorDetails(details.cause, seen);
  return result;
}

function idlConstantSeed(accountName: string): Uint8Array {
  const instruction = idl.instructions.find(({ name }) => name === "create_and_fund");
  const account = instruction?.accounts.find(({ name }) => name === accountName);
  const seed = account?.pda?.seeds.find(({ kind }) => kind === "const");

  if (!seed || !("value" in seed) || !Array.isArray(seed.value)) {
    throw new Error(`The IDL is missing the ${accountName} PDA seed.`);
  }

  return Uint8Array.from(seed.value);
}

function uint64LittleEndian(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & BigInt(0xff));
    remaining >>= BigInt(8);
  }
  return bytes;
}

function generateGiveawayId(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let id = BigInt(0);
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    id = (id << BigInt(8)) | BigInt(bytes[index]);
  }
  return id === BigInt(0) ? BigInt(1) : id;
}

function parsePrizeLamports(value: string): bigint | null {
  const amount = value.trim();
  if (!/^(?:\d+(?:\.\d{0,9})?|\.\d{1,9})$/.test(amount)) return null;

  const [whole = "0", fraction = ""] = amount.split(".");
  const lamports = BigInt(whole || "0") * BigInt("1000000000")
    + BigInt(fraction.padEnd(9, "0") || "0");
  return lamports > BigInt(0) && lamports <= BigInt("18446744073709551615")
    ? lamports
    : null;
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "The transaction could not be completed. Check Solflare and try again.";
}

export default function Home() {
  const { connection } = useConnection();
  const giveawayProgram = useGiveawayProgram();
  const {
    connected: solanaConnected,
    connecting: solanaConnecting,
    disconnecting: solanaDisconnecting,
    connect: connectSolana,
    disconnect: disconnectSolana,
    publicKey,
    select: selectSolanaWallet,
    wallet: selectedSolanaWallet,
    wallets: solanaWallets,
  } = useWallet();
  const mounted = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);
  const [title, setTitle] = useState("");
  const [prizeSol, setPrizeSol] = useState("");
  const [endAt, setEndAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [createdGiveaway, setCreatedGiveaway] = useState<{
    id: string;
    giveaway: PublicKey;
    vault: PublicKey;
    signature: string;
  } | null>(null);

  const logSolflareConnectionError = (context: string, error: unknown) => {
    const message = `Solflare ${context} failed:`;
    if (process.env.NODE_ENV === "development") {
      console.error(message, {
        error: getErrorDetails(error),
        walletAdapterName: selectedSolanaWallet?.adapter.name ?? null,
        walletSelected: selectedSolanaWallet !== null,
        connected: solanaConnected,
        connecting: solanaConnecting,
        disconnecting: solanaDisconnecting,
      });
      return;
    }
    console.error(message, error);
  };

  const handleSolanaWallet = async () => {
    if (solanaConnected) {
      await disconnectSolana();
      return;
    }

    if (selectedSolanaWallet?.adapter.name !== "Solflare") {
      const solflare = solanaWallets.find(({ adapter }) => adapter.name === "Solflare");
      if (solflare) selectSolanaWallet(solflare.adapter.name);
      return;
    }

    try {
      await connectSolana();
    } catch (error) {
      logSolflareConnectionError("connection", error);
    }
  };

  const reconnectSolana = async () => {
    try {
      await disconnectSolana();
      await connectSolana();
    } catch (error) {
      logSolflareConnectionError("reconnection", error);
    }
  };

  const createGiveaway = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreationError(null);
    setCreatedGiveaway(null);

    if (!solanaConnected || !publicKey || !giveawayProgram) {
      setCreationError("Connect Solflare before creating a giveaway.");
      return;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle || new TextEncoder().encode(normalizedTitle).length > 80) {
      setCreationError("Enter a title that is between 1 and 80 UTF-8 bytes.");
      return;
    }

    const prizeLamports = parsePrizeLamports(prizeSol);
    if (prizeLamports === null) {
      setCreationError("Enter a prize greater than 0 SOL with no more than 9 decimal places.");
      return;
    }

    const endTimestamp = Date.parse(endAt);
    const endAtSeconds = Math.floor(endTimestamp / 1_000);
    if (!Number.isFinite(endTimestamp) || endAtSeconds <= Math.floor(Date.now() / 1_000)) {
      setCreationError("Choose an end time in the future.");
      return;
    }

    setCreating(true);
    try {
      const giveawaySeed = idlConstantSeed("giveaway");
      const vaultSeed = idlConstantSeed("vault");
      let giveawayId = generateGiveawayId();
      let giveawayAddress: PublicKey | null = null;
      let vaultAddress: PublicKey | null = null;
      let availableAddress = false;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        [giveawayAddress] = PublicKey.findProgramAddressSync(
          [giveawaySeed, uint64LittleEndian(giveawayId)],
          SOLANA_GIVEAWAY_PROGRAM_ID,
        );
        [vaultAddress] = PublicKey.findProgramAddressSync(
          [vaultSeed, giveawayAddress.toBuffer()],
          SOLANA_GIVEAWAY_PROGRAM_ID,
        );

        if ((await connection.getAccountInfo(giveawayAddress)) === null) {
          availableAddress = true;
          break;
        }
        giveawayId = generateGiveawayId();
      }

      if (!availableAddress || !giveawayAddress || !vaultAddress) {
        throw new Error("Could not find an unused giveaway ID. Please try again.");
      }

      const signature = await giveawayProgram.methods
        .createAndFund(
          new BN(giveawayId.toString()),
          normalizedTitle,
          new BN(prizeLamports.toString()),
          new BN(endAtSeconds.toString()),
        )
        .accountsPartial({
          organizer: publicKey,
          giveaway: giveawayAddress,
          vault: vaultAddress,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setCreatedGiveaway({
        id: giveawayId.toString(),
        giveaway: giveawayAddress,
        vault: vaultAddress,
        signature,
      });
    } catch (error) {
      setCreationError(readableError(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6 sm:p-12">
      {/* Header */}
      <header className="w-full max-w-4xl flex flex-wrap justify-between items-center gap-4 pb-8 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
          <h1 className="text-2xl font-bold tracking-tight">Solana Giveaway Proof</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold uppercase text-emerald-300">
            Solana Devnet
          </span>
          {mounted ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSolanaWallet}
                disabled={solanaConnecting}
                className="h-10 rounded-md bg-[#512da8] px-4 text-sm font-semibold text-white transition hover:bg-[#45249a] disabled:cursor-wait disabled:opacity-60"
              >
                {solanaConnecting
                  ? "Connecting Solflare..."
                  : solanaConnected
                    ? "Disconnect Solflare"
                    : selectedSolanaWallet?.adapter.name === "Solflare"
                      ? "Connect Solflare"
                      : "Select Solflare"}
              </button>
              {solanaConnected && (
                <button
                  type="button"
                  onClick={reconnectSolana}
                  className="h-10 rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
                >
                  Reconnect Solflare
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="h-10 min-w-36 rounded-md bg-[#512da8] px-4 text-sm font-semibold text-white"
            >
              Select Solflare
            </button>
          )}
        </div>
      </header>
      {publicKey && (
        <p className="mt-3 w-full max-w-4xl break-all font-mono text-xs text-slate-400">
          Solana public key: {publicKey.toBase58()}
        </p>
      )}

      <section className="mt-12 w-full max-w-4xl space-y-3">
        <p className="text-lg text-slate-300">
          Lock giveaway funds on Solana and verify payouts or refunds on-chain.
        </p>
        <p className="text-sm text-slate-400">
          Winner selection is handled by the organizer; this app does not verify how the winner was chosen.
        </p>
      </section>

      <section className="mt-8 w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">Create a giveaway</h2>
          <p className="mt-2 text-sm text-slate-400">
            Create the giveaway account and fund its vault on Solana Devnet. Solflare will ask you to approve the transaction.
          </p>
        </div>

        <form onSubmit={createGiveaway} className="space-y-5">
          <div>
            <label htmlFor="giveaway-title" className="mb-2 block text-sm font-medium text-slate-200">
              Giveaway title
            </label>
            <input
              id="giveaway-title"
              required
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
              placeholder="Community launch giveaway"
            />
            <p className="mt-1 text-xs text-slate-500">Maximum 80 UTF-8 bytes.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="giveaway-prize" className="mb-2 block text-sm font-medium text-slate-200">
                Prize (SOL)
              </label>
              <input
                id="giveaway-prize"
                required
                inputMode="decimal"
                value={prizeSol}
                onChange={(event) => setPrizeSol(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                placeholder="0.25"
              />
              <p className="mt-1 text-xs text-slate-500">Up to 9 decimal places. The prize is sent from your connected wallet.</p>
            </div>
            <div>
              <label htmlFor="giveaway-end" className="mb-2 block text-sm font-medium text-slate-200">
                End time
              </label>
              <input
                id="giveaway-end"
                type="datetime-local"
                required
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-500"
              />
              <p className="mt-1 text-xs text-slate-500">Uses your local time zone; the program stores a UTC timestamp.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={!mounted || !solanaConnected || creating}
            className="h-11 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating
              ? "Creating and funding..."
              : solanaConnected
                ? "Create and fund giveaway"
                : "Connect Solflare to continue"}
          </button>
        </form>

        {creating && (
          <p role="status" className="mt-4 text-sm text-emerald-300">
            Waiting for Solflare approval and Devnet confirmation...
          </p>
        )}
        {creationError && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {creationError}
          </p>
        )}
        {createdGiveaway && (
          <div role="status" className="mt-5 space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="font-semibold">Giveaway created and funded on Devnet.</p>
            <p className="break-all font-mono text-xs">Giveaway ID: {createdGiveaway.id}</p>
            <p className="break-all font-mono text-xs">Giveaway PDA: {createdGiveaway.giveaway.toBase58()}</p>
            <p className="break-all font-mono text-xs">Vault PDA: {createdGiveaway.vault.toBase58()}</p>
            <a
              href={`https://explorer.solana.com/tx/${createdGiveaway.signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-medium text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
            >
              View transaction on Solana Explorer
            </a>
            <p className="break-all font-mono text-xs">Signature: {createdGiveaway.signature}</p>
          </div>
        )}

        <p className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
          This app never asks for or stores your private keys. All transaction approval happens in Solflare.
        </p>
      </section>
    </main>
  );
}