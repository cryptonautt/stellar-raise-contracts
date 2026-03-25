/**
 * WASM Build Pipeline Constants for Stellar Raise Contracts
 * Extracted from Cargo.toml [profile.release], .cargo/config.toml, and build scripts.
 * 
 * Usage: Import and use in Node scripts for cargo invocations, CI, or testing.
 * Ensures consistent WASM optimization for caching and reproducibility.
 * 
 * NatSpec-style:
 * @notice Constants for WASM build pipeline to improve testing readability and caching.
 * @dev Optimized for Soroban contracts (crowdfund, factory).
 * @security No runtime risks; compile-time config.
 */

export interface WasmProfileConfig {
  opt_level: 'z' | 's' | '0' | '1' | '2' | '3';
  overflow_checks: boolean;
  debug: 0 | 1 | 2;
  strip: 'none' | 'symbols' | 'all';
  debug_assertions: boolean;
  panic: 'unwind' | 'abort';
  codegen_units: number;
  lto: boolean | 'thin' | 'fat';
}

export interface WasmRustflags {
  stack_size: number;
  target_features: string[];
}

export const WASM_BUILD_CONSTANTS = {
  /**
   * Target triple for Soroban WASM builds.
   */
  target: 'wasm32-unknown-unknown' as const,

  /**
   * Release profile configuration (from Cargo.toml).
   * Used for production/testing WASM optimization.
   */
  profile: {
    opt_level: 'z' as const,
    overflow_checks: true,
    debug: 0,
    strip: 'symbols' as const,
    debug_assertions: false,
    panic: 'abort' as const,
    codegen_units: 1,
    lto: true as const,
  } satisfies WasmProfileConfig,

  /**
   * Rustflags for wasm32 target (from .cargo/config.toml).
   */
  rustflags: [
    '-C',
    'link-arg=-zstack-size=65536',
    '-C',
    'target-feature=-reference-types,-multivalue',
  ] as const,

  /**
   * Default network for deploy/testing.
   */
  network: 'testnet' as const,

  /**
   * Cargo command flags for release WASM build.
   */
  cargo_flags: [
    '--target',
    'wasm32-unknown-unknown',
    '--release',
  ] as const,
} as const;

export type WasmBuildConstants = typeof WASM_BUILD_CONSTANTS;

