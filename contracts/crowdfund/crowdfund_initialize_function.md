# crowdfund_initialize_function

Validated, auditable, and frontend-ready initialization logic for the crowdfund contract.

## Overview

This module is the single authoritative location for all `initialize()` logic.
It extracts validation and storage writes out of `lib.rs` into a dedicated,
independently-testable unit.

Key exports:

- `InitParams` — named struct replacing nine positional arguments
- `execute_initialize(env, params)` — the full initialization flow
- `validate_init_params(env, params)` — pure validation pass
- `validate_bonus_goal(bonus_goal, goal)` — bonus goal ordering check
- `describe_init_error(code)` — human-readable error messages for frontends
- `is_init_error_retryable(code)` — tells callers whether to retry
- `INIT_MIN_GOAL_AMOUNT` — re-export of `MIN_GOAL_AMOUNT` for convenience

## What changed

- Replaced the old `validate_initialize_inputs` / `persist_initialize_state`
  panic-based helpers with a single `execute_initialize` that returns typed
  `ContractError` variants.
- Introduced `InitParams` to eliminate silent parameter-order bugs.
- Validation now runs entirely before the first storage write (atomic).
- Added `initialized` event emission for off-chain indexers.
- Added `describe_init_error` and `is_init_error_retryable` for frontend use.

## Validation rules

| Parameter         | Rule                                    | Error                   |
|-------------------|-----------------------------------------|-------------------------|
| `goal`            | >= 1                                    | `InvalidGoal` (8)       |
| `min_contribution`| >= 1                                    | `InvalidMinContribution` (9) |
| `deadline`        | >= `now + 60s`                          | `DeadlineTooSoon` (10)  |
| `platform_config` | `fee_bps` <= 10 000 when `Some`         | `InvalidPlatformFee` (11) |
| `bonus_goal`      | > `goal` when `Some`                    | `InvalidBonusGoal` (12) |
| (re-init guard)   | `DataKey::Creator` must not exist       | `AlreadyInitialized` (1) |

## Validation flow

```
execute_initialize(env, params)
       │
       ├─► re-initialization guard     → AlreadyInitialized (1)
       ├─► creator.require_auth()
       ├─► validate_goal               → InvalidGoal (8)
       ├─► validate_min_contribution   → InvalidMinContribution (9)
       ├─► validate_deadline           → DeadlineTooSoon (10)
       ├─► validate_platform_fee       → InvalidPlatformFee (11)
       ├─► validate_bonus_goal         → InvalidBonusGoal (12)
       │
       └─► [all checks passed] write storage → emit event → Ok(())
```

## Security assumptions

1. **Re-initialization guard** — `DataKey::Creator` is used as the sentinel.
   It is the very first check, so no state can be written before it.

2. **Creator authentication** — `creator.require_auth()` is called before any
   storage write. An unauthorized call cannot leave partial state.

3. **Goal floor** — `goal >= 1` prevents zero-goal campaigns that could be
   immediately drained by the creator.

4. **Minimum contribution floor** — `min_contribution >= 1` prevents dust
   attacks and gas waste from zero-amount contributions.

5. **Deadline offset** — `deadline >= now + 60s` ensures the campaign is live
   for at least one ledger close interval.

6. **Platform fee cap** — `fee_bps <= 10_000` ensures the platform can never
   take more than 100% of raised funds, preventing creator-payout underflow.

7. **Bonus goal ordering** — `bonus_goal > goal` prevents a bonus goal that is
   already met at launch, which would immediately emit a bonus event.

8. **Atomic write ordering** — All validations complete before the first
   `env.storage().instance().set()` call. A failed validation leaves the
   contract in its pre-initialization state.

## Frontend integration

```typescript
// 1. Call initialize
const result = await contract.initialize({
  admin,
  creator,
  token,
  goal: 1_000_000n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  min_contribution: 1_000n,
  platform_config: null,
  bonus_goal: null,
  bonus_goal_description: null,
  metadata_uri: null,
});

// 2. On failure, map the error code
if (result.isErr()) {
  const code = result.error.value;
  const message = describeInitError(code); // use describe_init_error mapping
  const canRetry = isInitErrorRetryable(code);
}
```

Error code → message mapping (mirrors `describe_init_error`):

| Code | Message |
|------|---------|
| 1    | Contract is already initialized |
| 8    | Campaign goal must be at least 1 |
| 9    | Minimum contribution must be at least 1 |
| 10   | Deadline must be at least 60 seconds in the future |
| 11   | Platform fee cannot exceed 100% (10,000 bps) |
| 12   | Bonus goal must be strictly greater than the primary goal |

## Scalability

- `initialize()` is a one-shot O(1) function regardless of future campaign size.
- `Contributors` and `Roadmap` are seeded as empty vectors; their TTL is
  managed by `contribute()` and `add_roadmap_item()`.
- The `initialized` event payload is bounded to scalar values only — never
  unbounded collections.

## Test coverage

Run the module-specific tests:
Maintainability-focused extraction for `initialize()` validation and persistence.

## What changed

- Added `contracts/crowdfund/src/crowdfund_initialize_function.rs`.
- Moved `initialize()` validation concerns into:
  - `validate_initialize_inputs(...)`
  - `persist_initialize_state(...)`
- Added focused tests in `contracts/crowdfund/src/crowdfund_initialize_function.test.rs`.

## Security assumptions and guarantees

- `creator.require_auth()` remains enforced in `initialize()`.
- `goal > 0` and `min_contribution > 0` are now explicit guards.
- Platform fee guard remains capped at `10_000` bps (100%).
- Bonus goal must remain strictly greater than primary goal.
- Bonus-goal description still passes bounded length validation.

## Test coverage highlights

- Rejects zero goal.
- Rejects zero minimum contribution.
- Rejects platform fee > 100%.
- Rejects bonus goal `<= goal`.
- Verifies expected persisted state for successful initialization.

## Test command

```bash
cargo test --package crowdfund crowdfund_initialize_function_test
```

| Test | Covers |
|------|--------|
| `test_initialize_stores_core_fields` | All core fields stored correctly |
| `test_initialize_version_is_correct` | Contract version = 3 |
| `test_initialize_status_is_active` | Status = Active after init |
| `test_initialize_contributors_list_is_empty` | Empty contributor list |
| `test_initialize_twice_returns_already_initialized` | Re-init guard |
| `test_initialize_rejects_zero_goal` | goal = 0 → InvalidGoal |
| `test_initialize_rejects_negative_goal` | goal = -1 → InvalidGoal |
| `test_initialize_accepts_minimum_goal` | goal = 1 succeeds |
| `test_initialize_rejects_zero_min_contribution` | mc = 0 → InvalidMinContribution |
| `test_initialize_rejects_negative_min_contribution` | mc = -1 → InvalidMinContribution |
| `test_initialize_accepts_minimum_min_contribution` | mc = 1 succeeds |
| `test_initialize_rejects_past_deadline` | past deadline → DeadlineTooSoon |
| `test_initialize_rejects_deadline_below_min_offset` | now+59 → DeadlineTooSoon |
| `test_initialize_accepts_deadline_at_min_offset` | now+60 succeeds |
| `test_initialize_rejects_fee_over_100_percent` | fee_bps=10001 → InvalidPlatformFee |
| `test_initialize_accepts_fee_at_100_percent` | fee_bps=10000 succeeds |
| `test_initialize_accepts_zero_fee` | fee_bps=0 succeeds |
| `test_initialize_rejects_bonus_goal_equal_to_goal` | bg=goal → InvalidBonusGoal |
| `test_initialize_rejects_bonus_goal_below_goal` | bg<goal → InvalidBonusGoal |
| `test_initialize_accepts_bonus_goal_one_above_goal` | bg=goal+1 succeeds |
| `test_initialize_stores_bonus_goal_with_description` | Both bonus fields stored |
| `test_initialize_optional_fields_absent_when_not_provided` | No optional fields |
| `test_initialize_total_raised_starts_at_zero` | total_raised = 0 |
| `test_initialize_stores_token_address` | Token address stored |
| `test_initialize_stores_separate_admin` | Admin != creator works |
| `test_initialize_all_optional_fields_populated` | All fields at once |
| `test_initialize_emits_initialized_event` | Event emitted on success |
| `test_initialize_no_event_on_failure` | No event on failure; contract stays uninit |
| `test_describe_init_error_known_codes` | All known error codes |
| `test_describe_init_error_unknown_code` | Fallback for unknown codes |
| `test_is_init_error_retryable_already_initialized_is_permanent` | Code 1 not retryable |
| `test_is_init_error_retryable_input_errors_are_retryable` | Codes 8-12 retryable |
| `test_initialize_accepts_max_goal` | i128::MAX goal |
| `test_initialize_accepts_max_deadline` | u64::MAX deadline |
| `test_initialize_allows_min_contribution_greater_than_goal` | mc > goal allowed |
| `test_initialize_failed_call_leaves_contract_uninitialised` | Atomic rollback |
| `test_initialize_failed_platform_fee_leaves_contract_uninitialised` | Atomic rollback |
## Notes

- This refactor keeps behavior compatible while making initialization logic easier
  to review and audit.
