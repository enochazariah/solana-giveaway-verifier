use anchor_lang::prelude::*;

use crate::{
    constants::{GIVEAWAY_SEED, VAULT_SEED},
    error::ErrorCode,
    state::{Giveaway, GiveawayStatus},
};

#[derive(Accounts)]
pub struct CancelAndRefund<'info> {
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
    /// CHECK: The handler verifies this destination matches the recorded organizer.
    #[account(mut)]
    pub organizer: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_cancel_and_refund(ctx: Context<CancelAndRefund>) -> Result<()> {
    let giveaway = &ctx.accounts.giveaway;
    require!(
        giveaway.status == GiveawayStatus::Funded,
        ErrorCode::InvalidRefundStatus
    );
    require_keys_eq!(
        ctx.accounts.organizer.key(),
        giveaway.organizer,
        ErrorCode::RefundOrganizerMismatch
    );
    require!(
        Clock::get()?.unix_timestamp >= giveaway.refund_after,
        ErrorCode::RefundNotAvailable
    );

    let refund_lamports = ctx.accounts.vault.lamports();
    let giveaway_key = giveaway.key();
    let vault_bump = [giveaway.vault_bump];
    let vault_seeds = [VAULT_SEED, giveaway_key.as_ref(), &vault_bump];
    let signer_seeds = [&vault_seeds[..]];
    let transfer_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.organizer.to_account_info(),
    };
    let transfer_context = CpiContext::new_with_signer(
        anchor_lang::system_program::ID,
        transfer_accounts,
        &signer_seeds,
    );
    anchor_lang::system_program::transfer(transfer_context, refund_lamports)?;

    ctx.accounts.giveaway.status = GiveawayStatus::Refunded;

    Ok(())
}