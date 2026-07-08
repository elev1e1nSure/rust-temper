# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RustTemper — a Tauri (Rust backend) + React (TypeScript frontend) desktop GUI for editing the game Rust's config files: `keys.cfg` (keybinds) and `client.cfg` (graphics/tweaks). It auto-detects install paths via Steam's registry/`libraryfolders.vdf`, offers an interactive keyboard layout for rebinding, a known-command dictionary, and quality-tier sliders for graphics settings.

## Commands

```bash
pnpm install && pnpm tauri dev   # run the app (Tauri dev, starts Vite + Rust backend)
pnpm vite:dev                    # frontend only, no Tauri shell
pnpm build                       # tsc && vite build
pnpm typecheck                   # tsc --noEmit
pnpm lint                        # eslint src
pnpm format                      # prettier --write .
```

Rust backend (`src-tauri/`):
```bash
cargo test                       # run all Rust unit tests (each module has #[cfg(test)] blocks)
cargo test <test_name>           # run a single test
```

There is no frontend test suite — don't add one unless asked.

## Architecture

### Backend (`src-tauri/src/`)

- `lib.rs` — Tauri entry point; every `#[tauri::command]` must be registered in the `generate_handler!` list here or the frontend `invoke()` call fails silently at runtime.
- `client_cfg.rs` — the shared low-level engine for reading/writing `client.cfg`-style files (`key "value"` lines). `parse`/`apply_values`/`write_atomic` are used by both `tweaks.rs` and `graphics.rs` — never duplicate this parsing logic per-feature. `write_atomic` writes to a temp file and renames (crash-safe). A single process-wide `operation_lock()` mutex serializes all config mutations across tweaks and graphics so concurrent invokes can't interleave read-modify-write cycles.
- `graphics.rs` — quality sliders (shadows, textures, water, lighting, grass, clouds, smoothing) modeled as data-only `Quality` descriptors: a `label`, ordered `tiers` (each tier = a bundle of config key/value pairs), and a `ReadSpec` (either a single-key `Lookup` table or a `Custom` fn for settings needing joint state, like lighting's AO+contact-shadow combo). Adding a new graphics setting means adding one `const Quality` descriptor + two thin command wrappers — the read/write mechanics never change.
- `tweaks.rs` — on/off feature toggles (`TweakDef`) each declaring `backend_keys` (on/off value pairs) or a bind-based tweak. Toggling a tweak captures the prior value before overwriting it (so disabling restores it) via `tweak_state.rs`'s persisted `TweakState`. `TweakTx` wraps a toggle as a transaction: state is saved, then the config file write is attempted, and a failed write triggers `rollback_state` to undo the state save — keeping `tweak-state.json` and `client.cfg` from drifting out of sync. Multiple tweaks can share a backend key; `activation_order` tracks which tweak "owns" a key for correct restore-on-disable when several tweaks touch the same key.
- `tweak_state.rs` — persists `TweakState` (per-config baselines + active tweaks + activation order) to `tweak-state.json` in the Tauri app data dir, so the app remembers what it changed across restarts and can restore original values precisely.
- `keys_cfg.rs` — `keys.cfg` bind parsing/writing (`bind <key> <command>` lines).
- `known_commands.rs` — static dictionary of Rust console commands used for autocomplete/presets in the binds UI.
- `rust_locator/` — Steam install auto-detection: reads `libraryfolders.vdf` per Steam library, falls back to drive-root candidate paths. Platform-specific logic lives in `rust_locator_windows.rs`; non-Windows targets get empty-vec stubs.

### Frontend (`src/`)

- `App.tsx` — root component; owns `activePage` (see `navigation.ts` for the `PageId` union and nav items), wires up `useConfigFile` (config path + auto-detect + load), `useBindEditor` (bind CRUD/search/conflict state), and autosaves `keys.cfg` on every bind change (guarded against firing during a reload via `_isReloadingRef`).
- `hooks/useConfigFile.ts` — config path state, Steam auto-detect (`find_keys_cfg` invoke), manual file picker (`@tauri-apps/plugin-dialog`), and `keys.cfg` loading.
- `hooks/useBindEditor.ts`, `hooks/useTweaks.ts` — page-level state machines mirroring their respective backend command sets.
- `hooks/useSidebarResize.ts` — draggable sidebar width.
- `pages/` — one component per nav tab (`BindsPage`, `TweaksPage`, `GraphicsPage`, `SettingsPage`), each paired with a co-located `.css` file scoped to that page's root class — don't let one page's styles leak into another via unscoped selectors.
- `utils/paths.ts` — `clientCfgPathFor` derives `client.cfg`'s path from the known `keys.cfg` path (same directory, sibling file) rather than a second auto-detect round-trip.
- All backend calls go through `@tauri-apps/api/core`'s `invoke()`; command names/args must match the Rust `#[tauri::command]` signatures exactly (Rust uses `snake_case` field names but most DTOs are `#[serde(rename_all = "camelCase")]` — check the struct before assuming a field name on the TS side).

### Cross-cutting conventions

- Error strings returned from Rust commands are user-facing Russian text (e.g. `"Недопустимый уровень {tier}"`) — keep new error messages in Russian and consistent in tone with existing ones.
- Rust log messages (`log::info!`/`log::warn!`/`log::error!`) are in English with `key=value` style fields — keep this split (Russian user errors, English logs).
- Every new `client.cfg`/`keys.cfg` mutation must go through `client_cfg::write_atomic` + the shared `operation_lock()`, never raw `std::fs::write`.
