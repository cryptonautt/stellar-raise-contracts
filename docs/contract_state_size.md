# `contract_state_size` — Bounded Contract State for Reviewability and Reliability

## Overview

`contract_state_size` centralizes the limits for every crowdfund state field
whose size can grow from user input. The goal is to make worst-case storage
growth explicit, auditable, and enforceable in both local development and
CI/CD.

The module introduces pure validation helpers and wires them into the
contract's state-mutating entrypoints so oversize writes are rejected before
they are persisted.

## Why this matters

Without explicit bounds, a campaign can accumulate:

- Very large metadata strings (title, description, social links)
- Extremely long contributor or pledger indexes
- Unbounded roadmap entries
- Unbounded stretch-goal lists

That makes the contract harder to review, increases state- and payload-size
variance across environments, and weakens our confidence in worst-case
behavior during CI.

## Limits

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_CONTRIBUTORS` | `128` | Max indexed contributor addresses |
| `MAX_PLEDGERS` | `128` | Max indexed pledger addresses |
| `MAX_ROADMAP_ITEMS` | `32` | Max roadmap entries |
| `MAX_STRETCH_GOALS` | `32` | Max stretch-goal milestones |
| `MAX_TITLE_LENGTH` | `128` bytes | Max campaign title size |
| `MAX_DESCRIPTION_LENGTH` | `2048` bytes | Max campaign description size |
| `MAX_SOCIAL_LINKS_LENGTH` | `512` bytes | Max social-links field size |
| `MAX_BONUS_GOAL_DESCRIPTION_LENGTH` | `280` bytes | Max bonus-goal description size |
| `MAX_ROADMAP_DESCRIPTION_LENGTH` | `280` bytes | Max roadmap-item description size |
| `MAX_METADATA_TOTAL_LENGTH` | `2688` bytes | Combined title + description + socials budget |

### Design Rationale

- **Contributor/Pledger limits (128)**: Keeps `withdraw`/`refund`/`collect_pledges` 
  iteration within Soroban gas limits while supporting reasonable campaign sizes.
- **Roadmap/StretchGoal limits (32)**: Reasonable bounds for roadmap items and 
  milestone tracking without operational iteration requirements.
- **Metadata limits**: Individual fields have reasonable sizes; total budget (2688 bytes) 
  prevents fragmented metadata from collectively exceeding storage budget.
- **Description limits (280)**: Twitter-length descriptions encourage concise content 
  and prevent oversized entries.

## Validation Helpers

The module exposes pure helpers that return `Result<(), &'static str>` for
both contract code and tests to reuse:

### String Validators

- `validate_title(title: &String)` — Ensures title ≤ MAX_TITLE_LENGTH
- `validate_description(desc: &String)` — Ensures description ≤ MAX_DESCRIPTION_LENGTH
- `validate_social_links(socials: &String)` — Ensures social links ≤ MAX_SOCIAL_LINKS_LENGTH
- `validate_bonus_goal_description(desc: &String)` — Ensures ≤ MAX_BONUS_GOAL_DESCRIPTION_LENGTH
- `validate_roadmap_description(desc: &String)` — Ensures ≤ MAX_ROADMAP_DESCRIPTION_LENGTH

### Capacity Validators

- `validate_contributor_capacity(current_count: u32)` — Checks against MAX_CONTRIBUTORS
- `validate_pledger_capacity(current_count: u32)` — Checks against MAX_PLEDGERS
- `validate_roadmap_capacity(env: &Env)` — Reads roadmap from storage, checks against MAX_ROADMAP_ITEMS
- `validate_stretch_goal_capacity(env: &Env)` — Reads stretch goals from storage, checks against MAX_STRETCH_GOALS

### Aggregate Validators

- `validate_metadata_total_length(title_len, desc_len, socials_len)` — Uses checked arithmetic 
  to prevent overflow and validates combined length ≤ MAX_METADATA_TOTAL_LENGTH

### Storage Check Helpers

These read from persistent storage and return `StateSizeError`:

- `check_contributor_limit(env: &Env)` — Reads contributors Vec from storage
- `check_pledger_limit(env: &Env)` — Reads pledgers Vec from storage
- `check_roadmap_limit(env: &Env)` — Reads roadmap Vec from storage
- `check_stretch_goal_limit(env: &Env)` — Reads stretch goals Vec from storage

## Contract Integration

The following entrypoints enforce state-size limits:

### `initialize`

- Validates `bonus_goal_description` before storing it (≤ 280 bytes)

### `contribute`

- Rejects a contribution that would add a new address beyond `MAX_CONTRIBUTORS`
- Existing contributors can still contribute even when the contributor index is full

### `pledge`

- Rejects a pledge that would add a new address beyond `MAX_PLEDGERS`

### `update_metadata`

- Validates individual field lengths for `title` (≤ 128), `description` (≤ 2048), and `socials` (≤ 512)
- Validates combined metadata footprint using `validate_metadata_total_length`
- Uses checked arithmetic to prevent overflow attacks

### `add_roadmap_item`

- Rejects new entries once `MAX_ROADMAP_ITEMS` (32) is reached
- Rejects oversized roadmap descriptions (> 280 bytes)

### `add_stretch_goal`

- Rejects new milestones once `MAX_STRETCH_GOALS` (32) is reached

## Security Assumptions

1. **State bloat prevention**: Bounding collection growth prevents DoS attacks via 
   unbounded contributor/pledger/roadmap/stretch-goal lists.
2. **Rejection before persistence**: Oversized writes are rejected before persisting, 
   preventing silent storage bloat.
3. **Iteration safety**: Limiting indexed address lists reduces risk in flows that 
   iterate over those lists (withdraw, refund, collect_pledges).
4. **Metadata budget**: Combined metadata budget (2688 bytes) prevents campaigns from 
   storing several individually-valid but collectively excessive fields.
5. **Existing participant protection**: Contributor and pledger limits apply only to 
   new index growth; existing participants are never locked out.
6. **Overflow protection**: All aggregate length calculations use checked arithmetic 
   to prevent integer overflow attacks.

## Error Types

```rust
pub enum StateSizeError {
    ContributorLimitExceeded = 100,  // Contributors list full
    PledgerLimitExceeded = 101,       // Pledgers list full
    RoadmapLimitExceeded = 102,      // Roadmap list full
    StretchGoalLimitExceeded = 103,  // Stretch goals list full
    StringTooLong = 104,             // String exceeds byte limit
    MetadataTotalExceeded = 105,     // Combined metadata exceeds budget
}
```

## NatSpec-Style Documentation

Every public constant and validation function includes NatSpec-style comments:

- `@param` for parameter descriptions
- `@return` for return value descriptions
- `@notice` for important behavioral notes

This keeps the rules close to the code and aids future audits.

## Test Coverage

See `contracts/crowdfund/src/contract_state_size.test.rs`.

The dedicated test suite covers:

### Pure Helper Tests

- Constant stability verification
- Exact-boundary acceptance for all string limits
- Rejection one byte over each limit
- Overflow-safe aggregate length validation
- Collection-capacity acceptance at boundary
- Collection-capacity rejection at limit

### Contract Wiring Tests

- `initialize` accepts bonus goal description at exact limit
- `initialize` rejects oversized bonus goal description
- `update_metadata` accepts exact total budget
- `update_metadata` rejects total metadata over budget
- `contribute` rejects new contributor when index full
- `contribute` allows existing contributor when index full
- `pledge` rejects new pledger when index full
- `add_roadmap_item` rejects oversized description
- `add_roadmap_item` rejects when capacity full
- `add_stretch_goal` rejects when capacity full

## Review Notes

This implementation is intentionally small and focused:

- All limits live in one well-documented file
- Enforcement points are narrow and explicit
- Tests exercise both pure helpers and real contract calls
- Error messages are stable and searchable in logs
- Overflow protection is built into aggregate calculations

That keeps the change efficient to review while improving reliability and 
reducing unbounded-state risk.
# Contract State Size Limits

## Overview

The `contract_state_size` module enforces upper-bound limits on every
unbounded collection and user-supplied string stored in the crowdfund
contract's ledger state.

Without these limits an adversary could:

- Flood the `Contributors` or `Pledgers` list until `withdraw` / `refund` /
  `collect_pledges` iterations exceed Soroban's per-transaction resource budget.
- Supply oversized `String` values that push a ledger entry past the host's
  hard serialisation cap, causing a host panic.

---

## Limits

| Constant            | Value | Applies to                                    |
|---------------------|-------|-----------------------------------------------|
| `MAX_CONTRIBUTORS`  | 1 000 | `Contributors` list (contribute), `Pledgers` list (pledge) |
| `MAX_ROADMAP_ITEMS` |    20 | `Roadmap` list (add_roadmap_item)             |
| `MAX_STRETCH_GOALS` |    10 | `StretchGoals` list (add_stretch_goal)        |
| `MAX_STRING_LEN`    |   256 | title, description, social links, roadmap description |

### Rationale

**`MAX_CONTRIBUTORS = 1 000`**  
The `withdraw` function iterates over every contributor to mint NFT rewards
(capped at `MAX_NFT_MINT_BATCH = 50` per call), and `refund` iterates the
full list in one transaction. Keeping the list at ≤ 1 000 entries ensures
both operations stay within Soroban's instruction budget even before the
batch cap kicks in.

**`MAX_ROADMAP_ITEMS = 20`**  
The roadmap is stored in instance storage (loaded on every invocation).
Twenty items is generous for a campaign roadmap while keeping the instance
entry well below the ledger entry size limit.

**`MAX_STRETCH_GOALS = 10`**  
Stretch goals are also in instance storage and iterated in
`current_milestone`. Ten entries is more than sufficient for any realistic
campaign.

**`MAX_STRING_LEN = 256`**  
Soroban's ledger entry size limit is 64 KiB. A single 256-byte string field
is negligible, but without a cap a malicious creator could supply a 60 KiB
description and exhaust the entry budget for other fields.

---

## Error Codes

| Variant                    | Code | Meaning                                  |
|----------------------------|------|------------------------------------------|
| `ContributorLimitExceeded` |  100 | Contributors / pledgers list is full     |
| `RoadmapLimitExceeded`     |  101 | Roadmap list is full                     |
| `StretchGoalLimitExceeded` |  102 | Stretch-goals list is full               |
| `StringTooLong`            |  103 | A string field exceeds 256 bytes         |

Error codes start at 100 to avoid collisions with `ContractError` (1–7).

---

## Integration Points

The guards are called inside the contract methods **before** any state
mutation (checks-before-effects):

| Contract method    | Guard called                    |
|--------------------|---------------------------------|
| `contribute`       | `check_contributor_limit`       |
| `pledge`           | `check_pledger_limit`           |
| `add_roadmap_item` | `check_string_len`, `check_roadmap_limit` |
| `add_stretch_goal` | `check_stretch_goal_limit`      |

---

## Security Assumptions

1. Limits are enforced on every write path; read paths are unaffected.
2. Existing entries that pre-date this module are not retroactively removed.
   If a list already exceeds a limit (e.g. after a migration), new entries
   are still rejected.
3. Limits can only be changed via a contract upgrade (admin-only).
4. The `StateSizeError` discriminants are stable across upgrades; do not
   renumber them.

---

## Testing

Run the unit tests with:

```bash
cargo test --package crowdfund contract_state_size
```

The test suite (`contract_state_size_test.rs`) covers:

- Empty-list baseline (all helpers return `Ok`).
- One-below-limit (returns `Ok`).
- Exactly-at-limit (returns the correct `Err` variant).
- Over-limit (returns the correct `Err` variant).
- String boundary: at `MAX_STRING_LEN` → `Ok`; at `MAX_STRING_LEN + 1` → `Err`.
- Error discriminant stability.
