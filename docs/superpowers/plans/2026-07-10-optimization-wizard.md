# Optimization Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the locked Optimization tab with a four-step wizard that applies Windows performance changes and sets Rust's GC buffer.

**Architecture:** A new Rust `optimization` module exposes one narrow Tauri command per Windows action and a RAM-aware GC helper. The React page owns wizard navigation and invokes those commands one step at a time; the Steam launch-option module preserves unrelated options while updating `-gc.buffer`.

**Tech Stack:** Tauri 2, Rust 2021, Windows `powercfg` and registry commands, React 19, TypeScript 5.8, CSS.

## Global Constraints

- Keep the scope to PCIe LPM, HVCI, Xbox Game Bar, and GC Buffer only.
- Do not add automated tests unless the project owner explicitly asks.
- Do not modify the pre-existing `src-tauri/Cargo.lock` worktree change.
- Keep all user-facing copy in Russian and code comments in English.

---

### Task 1: System optimization backend

**Files:**
- Create: `src-tauri/src/optimization.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces `disable_pcie_lpm() -> Result<(), String>`.
- Produces `disable_hvci() -> Result<(), String>`.
- Produces `disable_xbox_game_bar() -> Result<(), String>`.
- Produces `apply_recommended_gc_buffer() -> Result<u32, String>`.

- [ ] **Step 1: Implement a shared PowerShell runner**

Create a helper that runs a non-interactive encoded script with `powershell.exe`, returns stderr on failure, and reports a cancelled UAC prompt as an error. Use it for commands that need an elevated child process.

- [ ] **Step 2: Implement PCIe LPM and HVCI actions**

Run `powercfg /setacvalueindex SCHEME_CURRENT SUB_PCIEXPRESS ASPM 0`, its DC equivalent, and `powercfg /setactive SCHEME_CURRENT` for PCIe LPM. For HVCI, invoke an elevated PowerShell child to set `HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity\Enabled` to `0`.

- [ ] **Step 3: Implement Xbox Game Bar action**

Set current-user Game DVR and Game Bar registry values to disabled without elevation. Create absent keys before writing values.

- [ ] **Step 4: Implement GC Buffer action**

Get total physical memory via PowerShell `Win32_ComputerSystem.TotalPhysicalMemory`. Map RAM to 2048, 4096, 6144, or 8192 MB, then call `steam_launch_options::set_rust_gc_buffer(buffer_mb)`.

- [ ] **Step 5: Register commands**

Add the new module and all four commands to Tauri's invoke handler in `src-tauri/src/lib.rs`.

### Task 2: Preserve Rust launch options while setting GC Buffer

**Files:**
- Modify: `src-tauri/src/steam_launch_options.rs`

**Interfaces:**
- Produces `pub fn set_rust_gc_buffer(buffer_mb: u32) -> Result<(), String>`.

- [ ] **Step 1: Add token replacement helper**

Implement a whitespace-token based helper that removes any `-gc.buffer` and its following numeric value, preserves unrelated option order, and appends exactly one `-gc.buffer <buffer_mb>` pair.

- [ ] **Step 2: Wire helper into launch-option mutation**

Read current launch options inside the existing Steam-safe mutation closure, rewrite the string through the helper, and write it back to the same key.

### Task 3: Optimization wizard interface

**Files:**
- Modify: `src/pages/OptimizationPage.tsx`
- Modify: `src/pages/OptimizationPage.css`

**Interfaces:**
- Consumes Tauri commands `disable_pcie_lpm`, `disable_hvci`, `disable_xbox_game_bar`, and `apply_recommended_gc_buffer`.
- Produces an accessible modal wizard with `Apply`, `Skip`, and `Close` controls.

- [ ] **Step 1: Replace the locked preview**

Render a normal optimization dashboard with a prominent "Запустить оптимизацию" button and a four-item status list. Remove the blur and non-interactive overlay.

- [ ] **Step 2: Define wizard steps**

Define a typed static list containing the four titles, summaries, explanatory text, and command names. The HVCI text explicitly says it weakens Windows protection and needs a restart; GC copy includes the selected MB result after success.

- [ ] **Step 3: Add stateful modal flow**

Track open state, zero-based step index, completion status per item, request progress, and command error. Apply invokes the current command, records success, then advances; Skip records skipped and advances. Close retains state. Completion displays a concise summary and close button.

- [ ] **Step 4: Match existing visual language**

Use the project panel, text, accent, and radius variables. Add a dimmed backdrop, centered modal, progress track, and responsive button layout. Buttons show `Применение...` while the command is running and cannot be double-clicked.

### Task 4: Verify and commit

**Files:**
- Modify: `src-tauri/src/optimization.rs`
- Modify: `src-tauri/src/steam_launch_options.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/pages/OptimizationPage.tsx`
- Modify: `src/pages/OptimizationPage.css`

- [ ] **Step 1: Format Rust**

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

Expected: no formatting diffs.

- [ ] **Step 2: Check frontend**

Run: `pnpm lint && pnpm build`

Expected: lint and production build succeed.

- [ ] **Step 3: Check Rust**

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

Expected: clippy exits successfully with no warnings.

- [ ] **Step 4: Commit the feature**

Run:

```powershell
git add src-tauri/src/optimization.rs src-tauri/src/steam_launch_options.rs src-tauri/src/lib.rs src/pages/OptimizationPage.tsx src/pages/OptimizationPage.css docs/superpowers/plans/2026-07-10-optimization-wizard.md
git commit -m "feat(optimization): add optimization wizard"
```
