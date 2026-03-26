# React Submit Button Component States

Addresses [GitHub Issue #359](https://github.com/Crowdfunding-DApp/stellar-raise-contracts/issues/359).

A reusable, accessible React submit button with a strict state machine, safe label handling, and double-submit prevention for crowdfunding transaction flows.

---

## Files

| File | Purpose |
|------|---------|
| `react_submit_button.tsx` | Component and pure helper exports |
| `react_submit_button.test.tsx` | Test suite (≥ 95% coverage) |
| `react_submit_button.md` | This document |

---

## State Machine

```
idle ──────────────────► submitting ──► success ──► idle
  │                          │                       │
  └──► disabled ◄────────────┘◄──── error ◄──────────┘
                                       │
                                       └──► submitting (retry)
```

| State | Visual | Interaction | `disabled` | `aria-busy` |
|-------|--------|-------------|------------|-------------|
| `idle` | Indigo | Clickable | No | No |
| `submitting` | Light indigo | Blocked | Yes | Yes |
| `success` | Green | Blocked | No | No |
| `error` | Red | Clickable (retry) | No | No |
| `disabled` | Grey | Blocked | Yes | No |

---

## Usage

```tsx
import ReactSubmitButton from "../components/react_submit_button";

// Basic
<ReactSubmitButton state={txState} onClick={handleSubmit} />

// With all options
<ReactSubmitButton
  state={txState}
  previousState={prevState}
  strictTransitions
  labels={{ idle: "Fund Campaign", submitting: "Funding..." }}
  onClick={handleContribute}
  type="submit"
  id="contribute-btn"
  className="my-btn"
/>
```

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `state` | `SubmitButtonState` | required | Current button state |
| `previousState` | `SubmitButtonState` | — | Used for strict transition validation |
| `strictTransitions` | `boolean` | `true` | Rejects invalid state jumps |
| `labels` | `SubmitButtonLabels` | — | Per-state label overrides |
| `onClick` | `(e) => void \| Promise<void>` | — | Click handler; blocked while submitting/disabled |
| `className` | `string` | — | Additional CSS class |
| `id` | `string` | — | HTML id attribute |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | HTML button type |
| `disabled` | `boolean` | — | External disabled override |

---

## Exported Helpers

All pure functions are exported for direct unit testing:

| Function | Description |
|----------|-------------|
| `normalizeSubmitButtonLabel(candidate, fallback)` | Sanitizes a label: rejects non-strings, strips control chars, normalizes whitespace, truncates to 80 chars |
| `resolveSubmitButtonLabel(state, labels?)` | Returns a safe label for the given state |
| `isValidSubmitButtonStateTransition(from, to)` | Returns true when the transition is in `ALLOWED_TRANSITIONS` |
| `resolveSafeSubmitButtonState(state, prev?, strict?)` | Falls back to `prev` when transition is invalid in strict mode |
| `isSubmitButtonInteractionBlocked(state, disabled?, locallySubmitting?)` | True when clicks must be suppressed |
| `isSubmitButtonBusy(state, locallySubmitting?)` | True when `aria-busy` should be set |
| `ALLOWED_TRANSITIONS` | Exported transition map (shared by component and tests) |

---

## Security Assumptions

### Double-submit prevention
`onClick` is suppressed in `submitting`, `disabled`, and locally-in-flight states. This prevents duplicate blockchain transactions when a user clicks rapidly while a transaction is pending.

### No HTML injection
Labels are rendered as React text nodes. `dangerouslySetInnerHTML` is never used. Hostile markup-like strings (e.g. `<img onerror=...>`) are inert plain text.

### No dynamic CSS injection
All background colours and cursors are sourced from the `STATE_STYLES` constant. No user-supplied strings are interpolated into CSS values.

### Label normalization
- Non-string values are rejected and replaced with defaults.
- Control characters (`U+0000–U+001F`, `U+007F`) are stripped.
- Labels are capped at 80 characters to prevent layout abuse.

### Strict transition enforcement
When `strictTransitions` is enabled (default), invalid state jumps fall back to `previousState`, preventing race-condition-driven UI inconsistencies.

---

## NatSpec-style Reference

### `ReactSubmitButton`
- **@notice** Accessible submit button with a strict state machine and safe label handling.
- **@param** `state` — Current button state (required).
- **@param** `previousState` — Used to validate transitions in strict mode.
- **@param** `strictTransitions` — When true, invalid transitions fall back to `previousState`. Default: `true`.
- **@param** `labels` — Optional per-state label overrides; values are normalized before use.
- **@param** `onClick` — Async-safe handler; blocked while submitting or disabled.
- **@security** Clicks are suppressed in non-interactive states (double-submit protection).
- **@security** Labels are sanitized to prevent blank CTA states and layout abuse.

### `normalizeSubmitButtonLabel`
- **@notice** Sanitizes a candidate label value.
- **@security** Strips control characters; truncates to 80 chars; rejects non-strings and empty values.

### `ALLOWED_TRANSITIONS`
- **@notice** Exported transition map shared by the component and test suite.
- **@dev** Single source of truth for valid state movements.

---

## Running Tests

```bash
# Run with coverage
npm test -- --testPathPattern=react_submit_button --coverage

# Watch mode
npm run test:watch -- --testPathPattern=react_submit_button
```

The suite covers:

- `normalizeSubmitButtonLabel` — non-string rejection, whitespace, control chars, truncation, XSS strings
- `resolveSubmitButtonLabel` — defaults, custom overrides, fallbacks, truncation
- `isValidSubmitButtonStateTransition` — all allowed paths, same-state, blocked paths
- `resolveSafeSubmitButtonState` — strict/non-strict, missing previousState
- `isSubmitButtonInteractionBlocked` — all blocking conditions
- `isSubmitButtonBusy` — submitting and local in-flight
- Component rendering — element, labels, data-state, type, className, id
- Component disabled behavior — all blocking states
- Component accessibility — aria-live, aria-busy, aria-label
- Component click handling — idle, error, blocked states, async, rejected promise
- Strict transition enforcement — invalid/valid transitions, strict off
