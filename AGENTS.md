# AGENTS.md

Tauri v2 desktop app (Rust backend + React TS frontend) for editing Rust game configs.

## Commands

```bash
pnpm typecheck                  # tsc --noEmit (always run before committing)
pnpm lint                       # eslint src
pnpm format                     # prettier --write .
cargo test                      # Rust unit tests (src-tauri/)
cargo test <name>               # single test
```

No frontend tests. Do not add any unless asked.

## Critical gotcha: Tauri command registration

Every `#[tauri::command]` must be listed in `lib.rs`'s `generate_handler!` macro. If you add a backend command and forget to register it, the frontend `invoke()` call fails silently at runtime -- no compile error, no warning, just a rejected promise.

## Config mutation rules

- All config writes go through `client_cfg::write_atomic()` (temp file + rename, crash-safe). Never use raw `std::fs::write`.
- Any read-modify-write cycle must hold `client_cfg::operation_lock()` -- a process-wide mutex serializing all mutations.
- `client_cfg::parse` / `apply_values` are shared by `tweaks.rs` and `graphics.rs`. Never duplicate parsing per feature.

## Architecture

- `lib.rs` -- Tauri entry; all `#[tauri::command]` registered here
- `client_cfg.rs` -- low-level `key "value"` read/parse/write; `operation_lock`
- `tweak_state.rs` -- persists `TweakState` to `tweak-state.json` (baselines + active tweaks + activation order)
- `tweaks.rs` -- toggle/slider logic; `TweakTx` wraps ops as state-then-write transactions with rollback on write failure
- `graphics.rs` -- quality sliders: data-only `Quality` descriptors, each with tiers, `ReadSpec`, and thin command wrappers
- `keys_cfg.rs` -- `bind <key> <command>` parsing; `apply_bind` (surgical edit) and `merge_binds` (full replace)
- `known_commands.rs` -- static command dictionary for binds UI
- `rust_locator/` -- Steam auto-detect (registry + `libraryfolders.vdf`); Windows-only, non-Windows returns empty vecs

Adding a graphics setting: one `const Quality` + two command wrappers. Adding a tweak: one `TweakDef` entry in `tweak_defs.rs`. Adding a command preset: one `preset()` call.

## Conventions

- Crate name is `rust_patch_lib` in Cargo.toml (not `rust-patch`) -- required on Windows to avoid bin/lib name collision.
- User-facing error strings are Russian; log messages are English with `key=value` fields.
- Rust DTOs use `#[serde(rename_all = "camelCase")]`. Frontend fields use camelCase, Rust source uses snake_case. Check the struct before assuming field names on either side.
- Each page component has a co-located `.css` scoped to that page's root class.
