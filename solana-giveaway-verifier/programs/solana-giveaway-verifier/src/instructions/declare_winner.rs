use anchor_lang::prelude::*;

use crate::{constants::GIVEAWAY_SEED, error::ErrorCode, state::{Giveaway, GiveawayStatus}};

#[derive(Accounts)]
pub struct DeclareWinner<'info> {
    pub organizer: Signer<'info>,
    #[account(
        mut,
        seeds = [GIVEAWAY_SEED, giveaway.giveaway_id.to_le_bytes().as_ref()],
        bump = giveaway.giveaway_bump,
        has_one = organizer @ ErrorCode::Unauthorized
    )]
    pub giveaway: Account<'info, Giveaway>,
}

pub fn handle_declare_winner(ctx: Context<DeclareWinner>, winner: Pubkey) -> Result<()> {
    require!(
        ctx.accounts.giveaway.status == GiveawayStatus::Funded,
        ErrorCode::InvalidGiveawayStatus
    );
    require!(winner != Pubkey::default(), ErrorCode::InvalidWinner);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.giveaway.end_at, ErrorCode::GiveawayNotEnded);
    require!(
        now < ctx.accounts.giveaway.refund_after,
        ErrorCode::WinnerDeclarationClosed
    );

    ctx.accounts.giveaway.winner = Some(winner);
    ctx.accounts.giveaway.status = GiveawayStatus::WinnerDeclared;

    Ok(())
}