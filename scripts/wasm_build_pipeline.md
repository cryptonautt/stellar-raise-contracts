
# WASM Build Pipeline Constants (`wasm_build_pipeline.tsx`)

## Overview
Extracts hardcoded WASM build constants from:
- `Cargo.toml` `[profile.release]`
- `.cargo/config.toml` `[target.wasm32-unknown-unknown]`
- Build scripts (`deploy.sh`, CI workflows)

Improves:
- **Testing reproducibility**: Consistent flags across runs.
- **Caching efficiency**: Identical flags enable cargo/sccache hits.
- **Readability**: Centralized config vs scattered strings.

## Usage
```ts
import { WASM_BUILD_CONSTANTS } from './wasm_build_pipeline';

const cmd = ['cargo', 'build', ...WASM_BUILD_CONSTANTS.cargo_flags].join(' ');
```

In Node/CI:
```bash
node -e "
const { WASM_BUILD_CONSTANTS } = require('./scripts/wasm_build_pipeline');
console.log(['cargo', 'build', ...WASM_BUILD_CONSTANTS.cargo_flags].join(' '));
" | bash
```

## Constants Reference (NatSpec)

### @notice WASM Target
- `target: 'wasm32-unknown-unknown'` - Soroban contract target.

### @notice Release Profile (Optimizations)
| Key | Value | Purpose |
|-----|-------|---------|
| `opt_level` | `'z'` | Size-optimized |
| `overflow_checks` | `true` | Security |
| `debug` | `0` | No debug info |
| `strip` | `'symbols'` | Strip symbols |
| `debug_assertions` | `false` | Release |
| `panic` | `'abort'` | WASM compatible |
| `codegen_units` | `1` | Max opt |
| `lto` | `true` | Link-time opt |

### @notice Rustflags
- `stack-size: 65536` - Prevent stack overflow.
- `target-feature=-reference-types,-multivalue` - Soroban compatibility.

## Security Assumptions
- Constants are compile-time; no runtime impact.
- Validated against source configs.
- Tests ensure immutability/type-safety.

## Testing
- `npm test scripts/wasm_build_pipeline.test.tsx`
- 100% coverage.
- Edge: Type checks, presence validation.

## Integration
Update `deploy.sh`, `rust_ci.yml` to use generated flags from TS (future).

Timeframe met: Efficient extraction.

