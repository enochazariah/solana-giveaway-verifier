"use client";

import { useMemo, type ReactNode } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = clusterApiUrl("devnet");
  const wallets = useMemo(
    () => [new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet })],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}