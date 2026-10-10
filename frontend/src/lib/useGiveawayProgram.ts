"use client";

import { AnchorProvider, Program } from "@anchor-lang/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import idl from "../idl/solana_giveaway_verifier.json";
import type { SolanaGiveawayVerifier } from "../idl/solana_giveaway_verifier";

export const SOLANA_GIVEAWAY_PROGRAM_ID = new PublicKey(
  "4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm",
);

export function useGiveawayProgram(): Program<SolanaGiveawayVerifier> | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
    const programIdl = {
      ...idl,
      address: SOLANA_GIVEAWAY_PROGRAM_ID.toBase58(),
    } as SolanaGiveawayVerifier;

    return new Program<SolanaGiveawayVerifier>(programIdl, provider);
  }, [connection, wallet]);
}