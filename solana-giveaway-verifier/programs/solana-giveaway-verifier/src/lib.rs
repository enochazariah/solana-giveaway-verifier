pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm");

#[program]
pub mod solana_giveaway_verifier {
    use super::*;

    pub fn create_and_fund(
        ctx: Context<CreateAndFund>,
        giveaway_id: u64,
        title: String,
        prize_lamports: u64,
        end_at: i64,
    ) -> Result<()> {
        crate::instructions::create_and_fund::handle_create_and_fund(
            ctx,
            giveaway_id,
            title,
            prize_lamports,
            end_at,
        )
    }

    pub fn declare_winner(ctx: Context<DeclareWinner>, winner: Pubkey) -> Result<()> {
        crate::instructions::declare_winner::handle_declare_winner(ctx, winner)
    }

    pub fn pay_winner(ctx: Context<PayWinner>) -> Result<()> {
        crate::instructions::pay_winner::handle_pay_winner(ctx)
    }

    pub fn cancel_and_refund(ctx: Context<CancelAndRefund>) -> Result<()> {
        crate::instructions::cancel_and_refund::handle_cancel_and_refund(ctx)
    }
}
