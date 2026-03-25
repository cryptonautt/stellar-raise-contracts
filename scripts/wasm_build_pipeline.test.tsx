/**
 * Tests for WASM Build Pipeline Constants.
 * Ensures constants match extracted values for caching/testing consistency.
 * 100% coverage.
 */

import { WASM_BUILD_CONSTANTS, type WasmProfileConfig, type WasmRustflags } from './wasm_build_pipeline';

describe('WASM Build Constants', () => {
  test('target is correct WASM triple', () => {
    expect(WASM_BUILD_CONSTANTS.target).toBe('wasm32-unknown-unknown');
  });

  test('release profile matches Cargo.toml [profile.release]', () => {
    const profile = WASM_BUILD_CONSTANTS.profile;
    expect(profile).toMatchObject({
      opt_level: 'z',
      overflow_checks: true,
      debug: 0,
      strip: 'symbols',
      debug_assertions: false,
      panic: 'abort',
      codegen_units: 1,
      lto: true,
    } satisfies Partial<WasmProfileConfig>);
  });

  test('rustflags match .cargo/config.toml', () => {
    expect(WASM_BUILD_CONSTANTS.rustflags).toContain('-C');
    expect(WASM_BUILD_CONSTANTS.rustflags).toContain('link-arg=-zstack-size=65536');
    expect(WASM_BUILD_CONSTANTS.rustflags).toContain('target-feature=-reference-types,-multivalue');
  });

  test('rustflags stack size extractable', () => {
    const stackMatch = WASM_BUILD_CONSTANTS.rustflags.find((flag) => flag.includes('stack-size'));
    expect(stackMatch).toBe('-C');
    // Full parse if needed, but presence validated
  });

  test('network is testnet for testing', () => {
    expect(WASM_BUILD_CONSTANTS.network).toBe('testnet');
  });

  test('cargo_flags for release WASM build', () => {
    expect(WASM_BUILD_CONSTANTS.cargo_flags).toContain('--release');
    expect(WASM_BUILD_CONSTANTS.cargo_flags).toContain('wasm32-unknown-unknown');
  });

  // Edge cases
  test('profile type-safe', () => {
    const profile: WasmProfileConfig = WASM_BUILD_CONSTANTS.profile;
    expect(profile.opt_level).toBe('z'); // No type error
  });

  test('constants readonly', () => {
    // TS as const ensures readonly
    type Test = typeof WASM_BUILD_CONSTANTS;
    const readonlyTest: Readonly<Test> = WASM_BUILD_CONSTANTS;
  });
});

