use {
    anchor_lang::{
        prelude::{Clock, Pubkey, Rent},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, Space, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const PRIZE_LAMPORTS: u64 = 250_000_000;
const FUTURE_END_AT: i64 = 1_000_000;

fn setup() -> (LiteSVM, Keypair) {
    let program_id = solana_giveaway_verifier::id();
    let mut svm = LiteSVM::new();
    let program_bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/solana_giveaway_verifier.so"
    ));
    svm.add_program(program_id, program_bytes).unwrap();

    let organizer = Keypair::new();
    svm.airdrop(&organizer.pubkey(), 2_000_000_000).unwrap();
    (svm, organizer)
}

fn giveaway_address(giveaway_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[
            solana_giveaway_verifier::constants::GIVEAWAY_SEED,
            &giveaway_id.to_le_bytes(),
        ],
        &solana_giveaway_verifier::id(),
    )
    .0
}

fn vault_address(giveaway: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[solana_giveaway_verifier::constants::VAULT_SEED, giveaway.as_ref()],
        &solana_giveaway_verifier::id(),
    )
    .0
}

fn create_and_fund(
    svm: &mut LiteSVM,
    organizer: &Keypair,
    giveaway_id: u64,
    title: &str,
    prize_lamports: u64,
    end_at: i64,
) -> bool {
    let program_id = solana_giveaway_verifier::id();
    let giveaway = giveaway_address(giveaway_id);
    let vault = vault_address(&giveaway);
    let instruction = Instruction::new_with_bytes(
        program_id,
        &solana_giveaway_verifier::instruction::CreateAndFund {
            giveaway_id,
            title: title.to_owned(),
            prize_lamports,
            end_at,
        }
        .data(),
        solana_giveaway_verifier::accounts::CreateAndFund {
            organizer: organizer.pubkey(),
            giveaway,
            vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );

    let message = Message::new_with_blockhash(
        &[instruction],
        Some(&organizer.pubkey()),
        &svm.latest_blockhash(),
    );
    let transaction = VersionedTransaction::try_new(
        VersionedMessage::Legacy(message),
        &[organizer],
    )
    .unwrap();
    svm.send_transaction(transaction).is_ok()
}

fn declare_winner(
    svm: &mut LiteSVM,
    organizer: &Keypair,
    giveaway_id: u64,
    winner: Pubkey,
) -> bool {
    let instruction = Instruction::new_with_bytes(
        solana_giveaway_verifier::id(),
        &solana_giveaway_verifier::instruction::DeclareWinner { winner }.data(),
        solana_giveaway_verifier::accounts::DeclareWinner {
            organizer: organizer.pubkey(),
            giveaway: giveaway_address(giveaway_id),
        }
        .to_account_metas(None),
    );
    let message = Message::new_with_blockhash(
        &[instruction],
        Some(&organizer.pubkey()),
        &svm.latest_blockhash(),
    );
    let transaction = VersionedTransaction::try_new(
        VersionedMessage::Legacy(message),
        &[organizer],
    )
    .unwrap();
    svm.send_transaction(transaction).is_ok()
}

fn pay_winner(
    svm: &mut LiteSVM,
    caller: &Keypair,
    giveaway_id: u64,
    winner: Pubkey,
) -> bool {
    let giveaway = giveaway_address(giveaway_id);
    let instruction = Instruction::new_with_bytes(
        solana_giveaway_verifier::id(),
        &solana_giveaway_verifier::instruction::PayWinner {}.data(),
        solana_giveaway_verifier::accounts::PayWinner {
            giveaway,
            vault: vault_address(&giveaway),
            winner,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let message = Message::new_with_blockhash(
        &[instruction],
        Some(&caller.pubkey()),
        &svm.latest_blockhash(),
    );
    let transaction = VersionedTransaction::try_new(
        VersionedMessage::Legacy(message),
        &[caller],
    )
    .unwrap();
    svm.send_transaction(transaction).is_ok()
}

fn cancel_and_refund(
    svm: &mut LiteSVM,
    caller: &Keypair,
    giveaway_id: u64,
    organizer_destination: Pubkey,
) -> bool {
    let giveaway = giveaway_address(giveaway_id);
    let instruction = Instruction::new_with_bytes(
        solana_giveaway_verifier::id(),
        &solana_giveaway_verifier::instruction::CancelAndRefund {}.data(),
        solana_giveaway_verifier::accounts::CancelAndRefund {
            giveaway,
            vault: vault_address(&giveaway),
            organizer: organizer_destination,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let message = Message::new_with_blockhash(
        &[instruction],
        Some(&caller.pubkey()),
        &svm.latest_blockhash(),
    );
    let transaction = VersionedTransaction::try_new(
        VersionedMessage::Legacy(message),
        &[caller],
    )
    .unwrap();
    svm.send_transaction(transaction).is_ok()
}

fn set_unix_timestamp(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

fn fund_winner_test_giveaway(svm: &mut LiteSVM, organizer: &Keypair, giveaway_id: u64) {
    assert!(create_and_fund(
        svm,
        organizer,
        giveaway_id,
        "Winner declaration test",
        PRIZE_LAMPORTS,
        FUTURE_END_AT,
    ));
}

fn declare_test_winner(
    svm: &mut LiteSVM,
    organizer: &Keypair,
    giveaway_id: u64,
    winner: Pubkey,
) {
    fund_winner_test_giveaway(svm, organizer, giveaway_id);
    set_unix_timestamp(svm, FUTURE_END_AT);
    assert!(declare_winner(svm, organizer, giveaway_id, winner));
}

fn load_giveaway(svm: &LiteSVM, giveaway_id: u64) -> solana_giveaway_verifier::state::Giveaway {
    let account = svm.get_account(&giveaway_address(giveaway_id)).unwrap();
    let mut data: &[u8] = &account.data;
    solana_giveaway_verifier::state::Giveaway::try_deserialize(&mut data).unwrap()
}

#[test]
fn successful_create_and_fund_records_giveaway_and_funds_vault() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 7;
    let giveaway_address = giveaway_address(giveaway_id);
    let vault = vault_address(&giveaway_address);

    assert!(create_and_fund(
        &mut svm,
        &organizer,
        giveaway_id,
        "Community grant",
        PRIZE_LAMPORTS,
        FUTURE_END_AT,
    ));

    let giveaway_account = svm.get_account(&giveaway_address).unwrap();
    let mut data: &[u8] = &giveaway_account.data;
    let giveaway = solana_giveaway_verifier::state::Giveaway::try_deserialize(&mut data).unwrap();

    assert_eq!(svm.get_account(&vault).unwrap().lamports, PRIZE_LAMPORTS);
    assert_eq!(giveaway.organizer, organizer.pubkey());
    assert_eq!(giveaway.giveaway_id, giveaway_id);
    assert_eq!(giveaway.status, solana_giveaway_verifier::state::GiveawayStatus::Funded);
    assert_eq!(giveaway.prize_lamports, PRIZE_LAMPORTS);
    assert_eq!(giveaway.end_at, FUTURE_END_AT);
    assert_eq!(giveaway.refund_after, FUTURE_END_AT + 86_400);
    assert!(giveaway.winner.is_none());
    assert_eq!(giveaway.paid_lamports, 0);
}

#[test]
fn rejects_zero_prize() {
    let (mut svm, organizer) = setup();
    let giveaway = giveaway_address(1);

    assert!(!create_and_fund(
        &mut svm,
        &organizer,
        1,
        "Community grant",
        0,
        FUTURE_END_AT,
    ));
    assert!(svm.get_account(&giveaway).is_none());
}

#[test]
fn rejects_past_deadline() {
    let (mut svm, organizer) = setup();
    let giveaway = giveaway_address(2);

    assert!(!create_and_fund(
        &mut svm,
        &organizer,
        2,
        "Community grant",
        PRIZE_LAMPORTS,
        -1,
    ));
    assert!(svm.get_account(&giveaway).is_none());
}

#[test]
fn rejects_refund_timestamp_overflow() {
    let (mut svm, organizer) = setup();
    let giveaway = giveaway_address(8);

    assert!(!create_and_fund(
        &mut svm,
        &organizer,
        8,
        "Community grant",
        PRIZE_LAMPORTS,
        i64::MAX,
    ));
    assert!(svm.get_account(&giveaway).is_none());
}

#[test]
fn rejects_title_over_byte_limit() {
    let (mut svm, organizer) = setup();
    let giveaway = giveaway_address(9);

    assert!(!create_and_fund(
        &mut svm,
        &organizer,
        9,
        &"x".repeat(81),
        PRIZE_LAMPORTS,
        FUTURE_END_AT,
    ));
    assert!(svm.get_account(&giveaway).is_none());
}

#[test]
fn rejects_duplicate_giveaway_id() {
    let (mut svm, organizer) = setup();

    assert!(create_and_fund(
        &mut svm,
        &organizer,
        3,
        "First grant",
        PRIZE_LAMPORTS,
        FUTURE_END_AT,
    ));
    assert!(!create_and_fund(
        &mut svm,
        &organizer,
        3,
        "Duplicate grant",
        PRIZE_LAMPORTS,
        FUTURE_END_AT,
    ));
}

#[test]
fn insufficient_funds_leave_no_giveaway_or_vault_funding() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 4;
    let giveaway = giveaway_address(giveaway_id);
    let vault = vault_address(&giveaway);
    let balance = svm.get_account(&organizer.pubkey()).unwrap().lamports;
    let account_rent = Rent::default().minimum_balance(
        8 + solana_giveaway_verifier::state::Giveaway::INIT_SPACE,
    );
    let prize_lamports = balance - account_rent + 1;

    assert!(!create_and_fund(
        &mut svm,
        &organizer,
        giveaway_id,
        "Too expensive",
        prize_lamports,
        FUTURE_END_AT,
    ));
    assert!(svm.get_account(&giveaway).is_none());
    assert!(svm.get_account(&vault).is_none());
}

#[test]
fn declares_winner_after_end_and_records_winner_status() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 10;
    let winner = Keypair::new().pubkey();
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    set_unix_timestamp(&mut svm, FUTURE_END_AT + 1);

    assert!(declare_winner(&mut svm, &organizer, giveaway_id, winner));

    let giveaway = load_giveaway(&svm, giveaway_id);
    assert_eq!(giveaway.winner, Some(winner));
    assert_eq!(
        giveaway.status,
        solana_giveaway_verifier::state::GiveawayStatus::WinnerDeclared
    );
}

#[test]
fn declares_winner_exactly_at_end_at() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 11;
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    set_unix_timestamp(&mut svm, FUTURE_END_AT);

    assert!(declare_winner(
        &mut svm,
        &organizer,
        giveaway_id,
        Keypair::new().pubkey(),
    ));
}

#[test]
fn rejects_declaration_before_end_at() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 12;
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    set_unix_timestamp(&mut svm, FUTURE_END_AT - 1);

    assert!(!declare_winner(
        &mut svm,
        &organizer,
        giveaway_id,
        Keypair::new().pubkey(),
    ));
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Funded
    );
}

#[test]
fn rejects_declaration_exactly_at_refund_after() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 13;
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    set_unix_timestamp(
        &mut svm,
        FUTURE_END_AT + solana_giveaway_verifier::constants::WINNER_DECLARATION_GRACE_SECONDS,
    );

    assert!(!declare_winner(
        &mut svm,
        &organizer,
        giveaway_id,
        Keypair::new().pubkey(),
    ));
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Funded
    );
}

#[test]
fn rejects_non_organizer_declaration() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 14;
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    set_unix_timestamp(&mut svm, FUTURE_END_AT);
    let non_organizer = Keypair::new();
    svm.airdrop(&non_organizer.pubkey(), 100_000_000).unwrap();

    assert!(!declare_winner(
        &mut svm,
        &non_organizer,
        giveaway_id,
        Keypair::new().pubkey(),
    ));
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Funded
    );
}

#[test]
fn rejects_default_winner() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 15;
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    set_unix_timestamp(&mut svm, FUTURE_END_AT);

    assert!(!declare_winner(
        &mut svm,
        &organizer,
        giveaway_id,
        Pubkey::default(),
    ));
    let giveaway = load_giveaway(&svm, giveaway_id);
    assert_eq!(giveaway.winner, None);
    assert_eq!(
        giveaway.status,
        solana_giveaway_verifier::state::GiveawayStatus::Funded
    );
}

#[test]
fn rejects_second_winner_declaration() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 16;
    let first_winner = Keypair::new().pubkey();
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    set_unix_timestamp(&mut svm, FUTURE_END_AT);

    assert!(declare_winner(
        &mut svm,
        &organizer,
        giveaway_id,
        first_winner,
    ));
    assert!(!declare_winner(
        &mut svm,
        &organizer,
        giveaway_id,
        Keypair::new().pubkey(),
    ));
    assert_eq!(load_giveaway(&svm, giveaway_id).winner, Some(first_winner));
}

#[test]
fn third_party_can_pay_recorded_winner_exact_prize_and_update_state() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 17;
    let winner = Keypair::new().pubkey();
    let caller = Keypair::new();
    declare_test_winner(&mut svm, &organizer, giveaway_id, winner);
    svm.airdrop(&winner, 50_000_000).unwrap();
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();
    let winner_balance_before = svm.get_account(&winner).unwrap().lamports;

    assert!(pay_winner(&mut svm, &caller, giveaway_id, winner));

    assert_eq!(
        svm.get_account(&winner).unwrap().lamports,
        winner_balance_before + PRIZE_LAMPORTS
    );
    let giveaway = load_giveaway(&svm, giveaway_id);
    assert_eq!(giveaway.paid_lamports, PRIZE_LAMPORTS);
    assert_eq!(
        giveaway.status,
        solana_giveaway_verifier::state::GiveawayStatus::Paid
    );
}

#[test]
fn rejects_payment_to_wrong_winner_account() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 18;
    let winner = Keypair::new().pubkey();
    let wrong_winner = Keypair::new().pubkey();
    let caller = Keypair::new();
    declare_test_winner(&mut svm, &organizer, giveaway_id, winner);
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();

    assert!(!pay_winner(&mut svm, &caller, giveaway_id, wrong_winner));
    assert_eq!(
        svm.get_account(&vault_address(&giveaway_address(giveaway_id)))
            .unwrap()
            .lamports,
        PRIZE_LAMPORTS
    );
    assert_eq!(load_giveaway(&svm, giveaway_id).paid_lamports, 0);
}

#[test]
fn rejects_payment_before_winner_is_declared() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 19;
    let winner = Keypair::new().pubkey();
    let caller = Keypair::new();
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();

    assert!(!pay_winner(&mut svm, &caller, giveaway_id, winner));
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Funded
    );
    assert_eq!(load_giveaway(&svm, giveaway_id).paid_lamports, 0);
}

#[test]
fn rejects_second_payment() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 20;
    let winner = Keypair::new().pubkey();
    let caller = Keypair::new();
    declare_test_winner(&mut svm, &organizer, giveaway_id, winner);
    svm.airdrop(&winner, 50_000_000).unwrap();
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();

    assert!(pay_winner(&mut svm, &caller, giveaway_id, winner));
    let winner_balance_after_first_payment = svm.get_account(&winner).unwrap().lamports;
    assert!(!pay_winner(&mut svm, &caller, giveaway_id, winner));

    assert_eq!(
        svm.get_account(&winner).unwrap().lamports,
        winner_balance_after_first_payment
    );
    assert_eq!(
        load_giveaway(&svm, giveaway_id).paid_lamports,
        PRIZE_LAMPORTS
    );
}

#[test]
fn payout_leaves_vault_excess_lamports_untouched() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 21;
    let winner = Keypair::new().pubkey();
    let caller = Keypair::new();
    let excess_lamports = 12_345;
    declare_test_winner(&mut svm, &organizer, giveaway_id, winner);
    let vault = vault_address(&giveaway_address(giveaway_id));
    svm.airdrop(&vault, excess_lamports).unwrap();
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();

    assert!(pay_winner(&mut svm, &caller, giveaway_id, winner));

    assert_eq!(
        svm.get_account(&vault).unwrap().lamports,
        excess_lamports
    );
}

#[test]
fn third_party_refunds_entire_vault_at_refund_after() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 22;
    let caller = Keypair::new();
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();
    let vault = vault_address(&giveaway_address(giveaway_id));
    let excess_lamports = 12_345;
    svm.airdrop(&vault, excess_lamports).unwrap();
    let vault_balance = svm.get_account(&vault).unwrap().lamports;
    let organizer_balance = svm.get_account(&organizer.pubkey()).unwrap().lamports;
    set_unix_timestamp(
        &mut svm,
        FUTURE_END_AT + solana_giveaway_verifier::constants::WINNER_DECLARATION_GRACE_SECONDS,
    );

    assert_ne!(caller.pubkey(), organizer.pubkey());
    assert!(cancel_and_refund(
        &mut svm,
        &caller,
        giveaway_id,
        organizer.pubkey(),
    ));

    assert_eq!(
        svm.get_account(&organizer.pubkey()).unwrap().lamports,
        organizer_balance + vault_balance
    );
    assert_eq!(
        svm.get_account(&vault).map(|account| account.lamports).unwrap_or_default(),
        0
    );
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Refunded
    );
}

#[test]
fn rejects_refund_before_refund_after() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 23;
    let caller = Keypair::new();
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();
    set_unix_timestamp(
        &mut svm,
        FUTURE_END_AT + solana_giveaway_verifier::constants::WINNER_DECLARATION_GRACE_SECONDS
            - 1,
    );

    assert!(!cancel_and_refund(
        &mut svm,
        &caller,
        giveaway_id,
        organizer.pubkey(),
    ));
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Funded
    );
}

#[test]
fn rejects_wrong_refund_organizer_destination() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 24;
    let caller = Keypair::new();
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();
    set_unix_timestamp(
        &mut svm,
        FUTURE_END_AT + solana_giveaway_verifier::constants::WINNER_DECLARATION_GRACE_SECONDS,
    );

    assert!(!cancel_and_refund(
        &mut svm,
        &caller,
        giveaway_id,
        Keypair::new().pubkey(),
    ));
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Funded
    );
}

#[test]
fn rejects_refund_after_winner_declaration() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 25;
    let caller = Keypair::new();
    declare_test_winner(
        &mut svm,
        &organizer,
        giveaway_id,
        Keypair::new().pubkey(),
    );
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();
    set_unix_timestamp(
        &mut svm,
        FUTURE_END_AT + solana_giveaway_verifier::constants::WINNER_DECLARATION_GRACE_SECONDS,
    );

    assert!(!cancel_and_refund(
        &mut svm,
        &caller,
        giveaway_id,
        organizer.pubkey(),
    ));
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::WinnerDeclared
    );
}

#[test]
fn rejects_second_refund() {
    let (mut svm, organizer) = setup();
    let giveaway_id = 26;
    let caller = Keypair::new();
    fund_winner_test_giveaway(&mut svm, &organizer, giveaway_id);
    svm.airdrop(&caller.pubkey(), 100_000_000).unwrap();
    set_unix_timestamp(
        &mut svm,
        FUTURE_END_AT + solana_giveaway_verifier::constants::WINNER_DECLARATION_GRACE_SECONDS,
    );

    assert!(cancel_and_refund(
        &mut svm,
        &caller,
        giveaway_id,
        organizer.pubkey(),
    ));
    let organizer_balance_after_refund = svm.get_account(&organizer.pubkey()).unwrap().lamports;
    assert!(!cancel_and_refund(
        &mut svm,
        &caller,
        giveaway_id,
        organizer.pubkey(),
    ));

    assert_eq!(
        svm.get_account(&organizer.pubkey()).unwrap().lamports,
        organizer_balance_after_refund
    );
    assert_eq!(
        load_giveaway(&svm, giveaway_id).status,
        solana_giveaway_verifier::state::GiveawayStatus::Refunded
    );
}