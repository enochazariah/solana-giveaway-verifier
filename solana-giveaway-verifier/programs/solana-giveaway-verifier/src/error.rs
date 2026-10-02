use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Prize must be greater than zero")]
    InvalidPrize,
    #[msg("The end time must be in the future")]
    InvalidEndTime,
    #[msg("Title must not be empty and must fit within the byte limit")]
    InvalidTitle,
    #[msg("Refund deadline overflowed")]
    TimestampOverflow,
    #[msg("Only the giveaway organizer may declare the winner")]
    Unauthorized,
    #[msg("Giveaway must be funded before declaring a winner")]
    InvalidGiveawayStatus,
    #[msg("The giveaway has not ended")]
    GiveawayNotEnded,
    #[msg("The winner declaration window has closed")]
    WinnerDeclarationClosed,
    #[msg("Winner must not be the default public key")]
    InvalidWinner,
    #[msg("Giveaway must have a declared winner before payment")]
    InvalidPaymentStatus,
    #[msg("The provided winner account does not match the recorded winner")]
    WinnerAccountMismatch,
    #[msg("Giveaway must be funded to refund")]
    InvalidRefundStatus,
    #[msg("The refund deadline has not been reached")]
    RefundNotAvailable,
    #[msg("The refund destination must be the recorded organizer")]
    RefundOrganizerMismatch,
}
