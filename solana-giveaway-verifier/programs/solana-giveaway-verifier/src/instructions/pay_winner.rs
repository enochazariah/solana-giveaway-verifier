use anchor_lang::prelude::*;

use crate::{
    constants::{GIVEAWAY_SEED, VAULT_SEED},
    error::ErrorCode,
    state::{Giveaway, GiveawayStatus},
};

#[derive(Accounts)]
pub struct PayWinner<'info> {
    #[account(
        mut,
        seeds = [GIVEAWAY_SEED, giveaway.giveaway_id.to_le_bytes().as_ref()],
        bump = giveaway.giveaway_bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    /// CHECK: This PDA is the native SOL vault and is signed for by the program.
    #[account(
        mut,
        seeds = [VAULT_SEED, giveaway.key().as_ref()],
        bump = giveaway.vault_bump
    )]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: The handler verifies this key matches the recorded winner before transferring.
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_pay_winner(ctx: Context<PayWinner>) -> Result<()> {
    let giveaway = &ctx.accounts.giveaway;
    require!(
        giveaway.status == GiveawayStatus::WinnerDeclared,
        ErrorCode::InvalidPaymentStatus
    );
    let recorded_winner = giveaway.winner.ok_or(ErrorCode::InvalidWinner)?;
    require_keys_eq!(
        ctx.accounts.winner.key(),
        recorded_winner,
        ErrorCode::WinnerAccountMismatch
    );

    let giveaway_key = giveaway.key();
    let vault_bump = [giveaway.vault_bump];
    let vault_seeds = [VAULT_SEED, giveaway_key.as_ref(), &vault_bump];
    let signer_seeds = [&vault_seeds[..]];
    let transfer_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.winner.to_account_info(),
    };
    let transfer_context = CpiContext::new_with_signer(
        anchor_lang::system_program::ID,
        transfer_accounts,
        &signer_seeds,
    );
    anchor_lang::system_program::transfer(transfer_context, giveaway.prize_lamports)?;

    let giveaway = &mut ctx.accounts.giveaway;
    giveaway.paid_lamports = giveaway.prize_lamports;
    giveaway.status = GiveawayStatus::Paid;

    Ok(())
}