use soroban_sdk::{Address, BytesN, Env};
use crate::DataKey;

// ── Constants ────────────────────────────────────────────────────────────────

/// A WASM hash of all-zero bytes is treated as unset / invalid.
/// Callers must upload a real WASM binary before calling `upgrade()`.
const ZERO_HASH: [u8; 32] = [0u8; 32];

// ── Public API ───────────────────────────────────────────────────────────────

/// Validates that the caller is the authorized admin for contract upgrades.
///
/// @notice Retrieves the admin address stored during `initialize()` and calls
///         `require_auth()` on it. Panics if no admin has been set.
/// @dev    Uses `require_auth()` which ensures the transaction is signed by
///         the admin address stored during initialization.
/// @return The admin `Address` that was authenticated.
///
/// @custom:security Never call this function without subsequently performing
///                  the upgrade — the auth check is not idempotent.
pub fn validate_admin_upgrade(env: &Env) -> Address {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("Admin not initialized");

    admin.require_auth();
    admin
}

/// Validates that `new_wasm_hash` is not the all-zero sentinel value.
///
/// @notice An all-zero hash indicates the WASM was never uploaded.
///         Rejecting it prevents a no-op upgrade that would still consume gas
///         and emit a misleading audit event.
/// @param  new_wasm_hash  The 32-byte SHA-256 hash to validate.
///
/// @custom:security This is a best-effort guard. The Soroban host will also
///                  reject an unregistered hash at execution time; this check
///                  surfaces the error earlier with a clear message.
pub fn validate_wasm_hash(new_wasm_hash: &BytesN<32>) -> bool {
    new_wasm_hash.to_array() != ZERO_HASH
}

/// Executes the WASM update.
///
/// @notice Replaces the running contract WASM with the binary identified by
///         `new_wasm_hash`. The contract address and all storage are preserved.
/// @dev    Must only be called after `validate_admin_upgrade()` and
///         `validate_wasm_hash()` have both passed.
/// @param  new_wasm_hash  SHA-256 hash of the new WASM binary (already uploaded).
///
/// @custom:security This operation is irreversible within the same transaction.
///                  Ensure the new WASM is thoroughly tested before calling.
pub fn perform_upgrade(env: &Env, new_wasm_hash: BytesN<32>) {
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}
