use anchor_lang::prelude::*;

#[constant]
pub const GIVEAWAY_SEED: &[u8] = b"giveaway";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

pub const MAX_TITLE_BYTES: usize = 80;
pub const WINNER_DECLARATION_GRACE_SECONDS: i64 = 86_400;
