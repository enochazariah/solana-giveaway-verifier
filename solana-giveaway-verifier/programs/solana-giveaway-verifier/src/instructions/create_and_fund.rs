use anchor_lang::prelude::*;

use crate::{
    constants::{GIVEAWAY_SEED, MAX_TITLE_BYTES, VAULT_SEED, WINNER_DECLARATION_GRACE_SECONDS},
    error::ErrorCode,
    state::{Giveaway, GiveawayStatus},
};

#[derive(Accounts)]
#[instruction(giveaway_id: u64)]
pub struct CreateAndFund<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        init,
        payer = organizer,
        space = 8 + Giveaway::INIT_SPACE,
        seeds = [GIVEAWAY_SEED, giveaway_id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    /// CHECK: This PDA is only a native SOL destination for the System Program transfer.
    #[account(
        mut,
        seeds = [VAULT_SEED, giveaway.key().as_ref()],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_and_fund(
    ctx: Context<CreateAndFund>,
    giveaway_id: u64,
    title: String,
    prize_lamports: u64,
    end_at: i64,
) -> Result<()> {
    require!(
        !title.is_empty() && title.len() <= MAX_TITLE_BYTES,
        ErrorCode::InvalidTitle
    );
    require!(prize_lamports > 0, ErrorCode::InvalidPrize);

    let clock = Clock::get()?;
    require!(end_at > clock.unix_timestamp, ErrorCode::InvalidEndTime);
    let refund_after = end_at
        .checked_add(WINNER_DECLARATION_GRACE_SECONDS)
        .ok_or(ErrorCode::TimestampOverflow)?;

    let giveaway = &mut ctx.accounts.giveaway;
    giveaway.organizer = ctx.accounts.organizer.key();
    giveaway.giveaway_id = giveaway_id;
    giveaway.title = title;
    giveaway.prize_lamports = prize_lamports;
    giveaway.created_at = clock.unix_timestamp;
    giveaway.end_at = end_at;
    giveaway.refund_after = refund_after;
    giveaway.status = GiveawayStatus::Funded;
    giveaway.winner = None;
    giveaway.paid_lamports = 0;
    giveaway.giveaway_bump = ctx.bumps.giveaway;
    giveaway.vault_bump = ctx.bumps.vault;

    let transfer_accounts = anchor_lang::system_program::Transfer {
        from: ctx.accounts.organizer.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
    };
    let transfer_context = CpiContext::new(
        anchor_lang::system_program::ID,
        transfer_accounts,
    );
    anchor_lang::system_program::transfer(transfer_context, prize_lamports)?;

    Ok(())
}