# Solana Giveaway Proof

Lock a giveaway prize on Solana, then let anyone verify the payout on-chain.

Giveaways run on trust: participants can't check that the prize exists or that it was paid. Solana Giveaway Proof locks the prize in a program-controlled vault when the giveaway is created. The funds can only leave the vault through the program's payout or refund rules, and the whole lifecycle is readable on-chain.

Built for the **Colosseum Crypto World's Fair** hackathon (Solana track, Superteam Nigeria side track).

## How it works

1. **Create and fund.** The organizer creates a giveaway with a title, a prize in SOL, and an end time. The prize moves from the organizer's wallet into a vault PDA owned by the program.
2. **Declare winner.** After the end time, the organizer declares the winner's wallet address.
3. **Pay winner.** The program releases the vault to the declared winner.
4. **Cancel and refund.** The program includes a refund instruction for the organizer when a giveaway isn't completed.
5. **Verify.** Anyone can look up a giveaway by ID and see its status, winner, paid amount, and vault balance, with no wallet needed.

Status values: `Funded` → `WinnerDeclared` → `Paid`, or `Refunded`.

**Important:** winner selection is handled by the organizer. This project proves that the prize was locked and paid out. It does not verify how the winner was chosen.

## Live on Devnet

- Program ID: `4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm`
- [View program on Solana Explorer](https://explorer.solana.com/address/4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm?cluster=devnet)

Example giveaway (ID `1791672139904`, prize 0.1 SOL):

- [Create and fund](https://explorer.solana.com/tx/7o7b8HGPxs7bCKBovY2pnQ7uUZtPWssDaLXLh6akDxcBUE7QLgCF62EtHQpZuhgTq5sts8gjAyrVg2pj5FesrB8?cluster=devnet)
- [Declare winner](https://explorer.solana.com/tx/2mzQ2TSQcg23b9z5vFzys6xX3Liqo9dDjGv2GCzSRNiN8C1kdu9WvFZbW2Moy3AxA887vr9MRzZVkEuUBFyp2BPB?cluster=devnet)
- [Pay winner](https://explorer.solana.com/tx/2AmFrtromK8hkeFrK8Ps3DeLT3eAd4ihy7U8jQqkxsEV4sAJHBE6ewgJ4U9wnLzkvo5pxpJcEiH5YESb4C9LrDQ6?cluster=devnet)
- [Vault account](https://explorer.solana.com/address/BBkcj3nBx1iDgYc1whMsDzn2coNRV2v3rX8gqXVBAFa9?cluster=devnet) (balance 0 after payout)

## Program instructions

| Instruction | What it does |
| --- | --- |
| `create_and_fund` | Creates the giveaway account and moves the prize into the vault PDA |
| `declare_winner` | Organizer records the winner's address (after the end time) |
| `pay_winner` | Releases the vault to the declared winner |
| `cancel_and_refund` | Returns funds to the organizer under the refund rules |

PDAs: `giveaway = ["giveaway", giveaway_id (u64, little-endian)]`, `vault = ["vault", giveaway pubkey]`.

## Tech stack

- Anchor 1.2 (Rust) Solana program
- Next.js 16, TypeScript, Tailwind CSS
- Solana wallet adapter (Solflare) and `@anchor-lang/core`

## Repository layout

- `solana-giveaway-verifier/`: the Anchor program
- `frontend/`: Next.js app, including the wallet-free `/verify` page and the CLI scripts
- `src/`, `test/`, `script/`, `lib/`, `foundry.toml`: an earlier Ethereum donation prototype, kept as the baseline from the repo's first commit. It is not part of this submission.

## Run it

Program (needs Solana CLI and Anchor):

```
cd solana-giveaway-verifier
anchor build
anchor deploy --provider.cluster devnet
```

Frontend:

```
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000/verify`, enter a giveaway ID, and click Verify.

CLI scripts (run from `frontend/`, using a Devnet-funded wallet at `~/.config/solana/id.json`):

```
node cli-create-giveaway.mjs        # creates a 0.1 SOL giveaway ending in 3 minutes
node cli-declare-pay.mjs <GIVEAWAY_ID>   # declares a winner and pays them
```

## Current status and limitations

- Devnet only. The program has not been audited.
- The browser create form needs Solflare set to Devnet. Declare winner and pay winner currently run through the CLI scripts, and the refund instruction is not yet in the UI.
- The organizer chooses the winner. Verifiable winner selection is future work.

## Roadmap

- Organizer dashboard in the UI for declare, pay, and refund
- Verifiable, on-chain winner selection
- Mainnet deployment after an audit
