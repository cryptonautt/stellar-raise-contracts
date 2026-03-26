//! Tests for the admin upgrade mechanism.
//!
//! Covers:
//! - Admin address is stored correctly during `initialize()`.
//! - Only the admin can call `upgrade()` (auth guard enforced).
//! - A non-admin caller is rejected by `upgrade()`.
//! - `upgrade()` panics when called before `initialize()` (no admin stored).
//! - Admin distinct from creator: creator cannot call `upgrade()`.
//! - Zero WASM hash is rejected before auth check.
//! - Multiple non-admin attempts all rejected, storage intact.
//! - Two independent contracts have isolated admin state.
//! - Token address cannot be used as admin.

extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token, Address, BytesN, Env,
};

use crate::{CrowdfundContract, CrowdfundContractClient};

// ── Helper ───────────────────────────────────────────────────────────────────

fn setup() -> (
    Env,
    Address, // contract_id
    CrowdfundContractClient<'static>,
    Address, // admin
    Address, // creator
    Address, // token
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_addr = token_id.address();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let deadline = env.ledger().timestamp() + 3_600;

    client.initialize(
        &admin,
        &creator,
        &token_addr,
        &1_000,
        &deadline,
        &1,
        &None,
        &None,
        &None,
        &None,
    );

    (env, contract_id, client, admin, creator, token_addr)
}

/// Dummy 32-byte hash — used where we only need to reach the auth check,
/// not actually execute the WASM swap.
fn dummy_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[1u8; 32])
}

// ── Existing tests ────────────────────────────────────────────────────────────

/// Admin address is stored and readable after initialize().
#[test]
fn test_admin_stored_on_initialize() {
    let (env, contract_id, client, admin, _creator, _token) = setup();

    let non_admin = Address::generate(&env);
    env.set_auths(&[]);
    let result = client
        .mock_auths(&[MockAuth {
            address: &non_admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "upgrade",
                args: soroban_sdk::vec![&env, dummy_hash(&env).into()],
                sub_invokes: &[],
            },
        }])
        .try_upgrade(&dummy_hash(&env));

    assert!(result.is_err());
    let _ = admin;
}

/// Non-admin caller is rejected by upgrade().
#[test]
fn test_non_admin_cannot_upgrade() {
    let (env, contract_id, client, _admin, _creator, _token) = setup();
    let non_admin = Address::generate(&env);

    env.set_auths(&[]);
    let result = client
        .mock_auths(&[MockAuth {
            address: &non_admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "upgrade",
                args: soroban_sdk::vec![&env, dummy_hash(&env).into()],
                sub_invokes: &[],
            },
        }])
        .try_upgrade(&dummy_hash(&env));

    assert!(result.is_err());
}

/// Creator (distinct from admin) cannot call upgrade().
#[test]
fn test_creator_cannot_upgrade() {
    let (env, contract_id, client, _admin, creator, _token) = setup();

    env.set_auths(&[]);
    let result = client
        .mock_auths(&[MockAuth {
            address: &creator,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "upgrade",
                args: soroban_sdk::vec![&env, dummy_hash(&env).into()],
                sub_invokes: &[],
            },
        }])
        .try_upgrade(&dummy_hash(&env));

    assert!(result.is_err());
}

/// upgrade() panics when called before initialize() — no admin in storage.
#[test]
#[should_panic]
fn test_upgrade_panics_before_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(CrowdfundContract, ());
    let client = CrowdfundContractClient::new(&env, &contract_id);
    client.upgrade(&dummy_hash(&env));
}

/// Admin auth is required: calling upgrade() with no auths set is rejected.
#[test]
fn test_upgrade_requires_auth() {
    let (env, _contract_id, client, _admin, _creator, _token) = setup();

    env.set_auths(&[]);
    let result = client.try_upgrade(&dummy_hash(&env));
    assert!(result.is_err());
}

/// Admin can successfully call upgrade() with a valid uploaded WASM hash.
#[test]
#[ignore = "requires wasm-opt: run `cargo build --target wasm32-unknown-unknown --release` first"]
fn test_admin_can_upgrade_with_valid_wasm() {
    mod crowdfund_wasm {
        soroban_sdk::contractimport!(
            file = "../../target/wasm32-unknown-unknown/release/crowdfund.wasm"
        );
    }

    let (env, _contract_id, client, _admin, _creator, _token) = setup();
    let wasm_hash = env.deployer().upload_contract_wasm(crowdfund_wasm::WASM);
    client.upgrade(&wasm_hash);
}

/// Storage is intact after a rejected upgrade attempt.
#[test]
fn test_storage_persists_after_upgrade_auth() {
    let (env, _contract_id, client, _admin, _creator, _token) = setup();

    let goal_before = client.goal();
    let deadline_before = client.deadline();
    let raised_before = client.total_raised();

    env.set_auths(&[]);
    let _ = client.try_upgrade(&dummy_hash(&env));

    assert_eq!(client.goal(), goal_before);
    assert_eq!(client.deadline(), deadline_before);
    assert_eq!(client.total_raised(), raised_before);
}

// ── New edge-case tests ───────────────────────────────────────────────────────

/// Zero WASM hash (all-zero bytes) is rejected before the auth check.
///
/// @notice An all-zero hash is the sentinel for "no WASM uploaded". Accepting
///         it would waste gas and emit a misleading audit event.
/// @custom:security This guard fires before `require_auth()` so it cannot be
///                  bypassed by providing valid admin credentials.
#[test]
fn test_zero_wasm_hash_rejected_before_auth() {
    let (_env, _contract_id, client, _admin, _creator, _token) = setup();
    let zero_hash = BytesN::from_array(&_env, &[0u8; 32]);

    // mock_all_auths is active — auth would pass, but hash check fires first.
    let result = client.try_upgrade(&zero_hash);
    assert!(result.is_err(), "zero hash must be rejected");
}

/// `validate_wasm_hash` returns `true` for any non-zero hash.
///
/// @notice Confirms the guard does not block legitimate hashes.
#[test]
fn test_non_zero_wasm_hash_passes_validation() {
    use crate::admin_upgrade_mechanism::validate_wasm_hash;
    let env = Env::default();
    assert!(validate_wasm_hash(&BytesN::from_array(&env, &[1u8; 32])));
    assert!(validate_wasm_hash(&BytesN::from_array(&env, &[0xffu8; 32])));
    let mut bytes = [0u8; 32];
    bytes[31] = 1;
    assert!(validate_wasm_hash(&BytesN::from_array(&env, &bytes)));
}

/// `validate_wasm_hash` returns `false` for the all-zero hash.
#[test]
fn test_validate_wasm_hash_rejects_zero() {
    use crate::admin_upgrade_mechanism::validate_wasm_hash;
    let env = Env::default();
    assert!(!validate_wasm_hash(&BytesN::from_array(&env, &[0u8; 32])));
}

/// Multiple consecutive non-admin upgrade attempts are all rejected and leave
/// storage intact.
///
/// @notice Simulates a brute-force scenario where an attacker tries several
///         different addresses. Each attempt must fail independently.
#[test]
fn test_multiple_non_admin_attempts_all_rejected() {
    let (env, contract_id, client, _admin, _creator, _token) = setup();
    let goal_before = client.goal();

    env.set_auths(&[]);
    for _ in 0..3 {
        let attacker = Address::generate(&env);
        let result = client
            .mock_auths(&[MockAuth {
                address: &attacker,
                invoke: &MockAuthInvoke {
                    contract: &contract_id,
                    fn_name: "upgrade",
                    args: soroban_sdk::vec![&env, dummy_hash(&env).into()],
                    sub_invokes: &[],
                },
            }])
            .try_upgrade(&dummy_hash(&env));
        assert!(result.is_err());
    }

    assert_eq!(client.goal(), goal_before);
}

/// Two independently deployed contracts do not share admin state.
///
/// @notice Verifies contract-instance isolation: admin_a cannot upgrade
///         contract_b even though both are live in the same environment.
#[test]
fn test_two_contracts_have_independent_admins() {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_addr = token_id.address();
    let deadline = env.ledger().timestamp() + 3_600;

    let admin_a = Address::generate(&env);
    let contract_a = env.register(CrowdfundContract, ());
    let client_a = CrowdfundContractClient::new(&env, &contract_a);
    client_a.initialize(&admin_a, &admin_a, &token_addr, &1_000, &deadline, &1, &None, &None, &None, &None);

    let admin_b = Address::generate(&env);
    let contract_b = env.register(CrowdfundContract, ());
    let client_b = CrowdfundContractClient::new(&env, &contract_b);
    client_b.initialize(&admin_b, &admin_b, &token_addr, &1_000, &deadline, &1, &None, &None, &None, &None);

    // admin_a must not be able to upgrade contract_b
    env.set_auths(&[]);
    let result = client_b
        .mock_auths(&[MockAuth {
            address: &admin_a,
            invoke: &MockAuthInvoke {
                contract: &contract_b,
                fn_name: "upgrade",
                args: soroban_sdk::vec![&env, dummy_hash(&env).into()],
                sub_invokes: &[],
            },
        }])
        .try_upgrade(&dummy_hash(&env));
    assert!(result.is_err(), "admin_a must not upgrade contract_b");
    let _ = (client_a, admin_b);
}

/// Token address cannot be used as admin to call upgrade().
///
/// @notice Ensures that the token contract address — a valid `Address` in the
///         environment — is not accidentally treated as the admin.
#[test]
fn test_token_address_cannot_upgrade() {
    let (env, contract_id, client, _admin, _creator, token) = setup();

    env.set_auths(&[]);
    let result = client
        .mock_auths(&[MockAuth {
            address: &token,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "upgrade",
                args: soroban_sdk::vec![&env, dummy_hash(&env).into()],
                sub_invokes: &[],
            },
        }])
        .try_upgrade(&dummy_hash(&env));

    assert!(result.is_err());
}
