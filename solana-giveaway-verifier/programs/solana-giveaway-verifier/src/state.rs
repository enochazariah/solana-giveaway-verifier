use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Giveaway {
    pub organizer: Pubkey,
    pub giveaway_id: u64,
    #[max_len(80)]
    pub title: String,
    pub prize_lamports: u64,
    pub created_at: i64,
    pub end_at: i64,
    pub refund_after: i64,
    pub status: GiveawayStatus,
    pub winner: Option<Pubkey>,
    pub paid_lamports: u64,
    pub giveaway_bump: u8,
    pub vault_bump: u8,
}

#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GiveawayStatus {
    Funded,
    WinnerDeclared,
    Paid,
    Refunded,
}
