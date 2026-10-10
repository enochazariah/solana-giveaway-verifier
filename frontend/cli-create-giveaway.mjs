import fs from "node:fs";
import os from "node:os";
import { AnchorProvider, BN, Program } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm");
const idl = JSON.parse(
  fs.readFileSync("../solana-giveaway-verifier/target/idl/solana_giveaway_verifier.json", "utf8")
);
const secret = JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8"));
const kp = Keypair.fromSecretKey(Uint8Array.from(secret));

const wallet = {
  publicKey: kp.publicKey,
  signTransaction: async (tx) => {
    if ("version" in tx) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  },
  signAllTransactions: async (txs) => {
    for (const tx of txs) {
      if ("version" in tx) tx.sign([kp]);
      else tx.partialSign(kp);
    }
    return txs;
  },
};

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
const program = new Program(idl, provider);

const enc = new TextEncoder();
const giveawayId = new BN(Date.now());
const [giveaway] = PublicKey.findProgramAddressSync(
  [enc.encode("giveaway"), new Uint8Array(giveawayId.toArray("le", 8))],
  PROGRAM_ID
);
const [vault] = PublicKey.findProgramAddressSync(
  [enc.encode("vault"), giveaway.toBytes()],
  PROGRAM_ID
);

const endAt = new BN(Math.floor(Date.now() / 1000) + 180); // ends in 3 minutes
const prize = new BN(100_000_000); // 0.1 SOL

const signature = await program.methods
  .createAndFund(giveawayId, "CLI test giveaway", prize, endAt)
  .accountsPartial({
    organizer: kp.publicKey,
    giveaway,
    vault,
    systemProgram: SystemProgram.programId,
  })
  .rpc();

console.log("Signature:", signature);
console.log("Explorer: https://explorer.solana.com/tx/" + signature + "?cluster=devnet");
console.log("Giveaway ID:", giveawayId.toString());
console.log("Giveaway account:", giveaway.toBase58());
console.log("Vault account:", vault.toBase58());
console.log("Vault balance (lamports):", await connection.getBalance(vault));
fs.writeFileSync("last-giveaway.json", JSON.stringify({ giveawayId: giveawayId.toString() }));