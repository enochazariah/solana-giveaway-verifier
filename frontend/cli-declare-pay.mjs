import fs from "node:fs";
import os from "node:os";
import { AnchorProvider, BN, Program } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm");
const WINNER = new PublicKey("FtkGvFqMPXtR1RQZwWD1Ugp3w6eXPEA9NBN3k3GmTCc");

const idl = JSON.parse(
  fs.readFileSync("../solana-giveaway-verifier/target/idl/solana_giveaway_verifier.json", "utf8")
);
const secret = JSON.parse(fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8"));
const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
const sign = (tx) => ("version" in tx ? tx.sign([kp]) : tx.partialSign(kp));
const wallet = {
  publicKey: kp.publicKey,
  signTransaction: async (tx) => (sign(tx), tx),
  signAllTransactions: async (txs) => (txs.forEach(sign), txs),
};

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
const program = new Program(idl, provider);

const idArg = process.argv[2] ?? JSON.parse(fs.readFileSync("last-giveaway.json", "utf8")).giveawayId;
const giveawayId = new BN(idArg);
const enc = new TextEncoder();
const [giveaway] = PublicKey.findProgramAddressSync(
  [enc.encode("giveaway"), new Uint8Array(giveawayId.toArray("le", 8))],
  PROGRAM_ID
);
const [vault] = PublicKey.findProgramAddressSync(
  [enc.encode("vault"), giveaway.toBytes()],
  PROGRAM_ID
);

const status = async () => Object.keys((await program.account.giveaway.fetch(giveaway)).status)[0];
console.log("Giveaway ID:", giveawayId.toString());
console.log("Status before:", await status());
console.log("Winner balance before:", await connection.getBalance(WINNER));

const declareSig = await program.methods
  .declareWinner(WINNER)
  .accountsPartial({ organizer: kp.publicKey, giveaway })
  .rpc();
console.log("Declare winner:", "https://explorer.solana.com/tx/" + declareSig + "?cluster=devnet");
console.log("Status after declare:", await status());

const paySig = await program.methods
  .payWinner()
  .accountsPartial({ giveaway, vault, winner: WINNER, systemProgram: SystemProgram.programId })
  .rpc();
console.log("Pay winner:", "https://explorer.solana.com/tx/" + paySig + "?cluster=devnet");
console.log("Status after pay:", await status());
console.log("Winner balance after:", await connection.getBalance(WINNER));
console.log("Vault balance after:", await connection.getBalance(vault));
