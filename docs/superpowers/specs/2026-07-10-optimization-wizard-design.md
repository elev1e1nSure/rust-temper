# Optimization wizard

## Scope

Replace the locked Optimization tab with a five-step modal wizard:

1. Disable PCIe Link State Power Management.
2. Disable Hypervisor-protected Code Integrity (HVCI).
3. Disable Xbox Game Bar and Game DVR.
4. Enable Windows Game Mode.
5. Calculate and set Rust's `-gc.buffer` launch option in Steam.

## User flow

The page shows an actionable optimization card and a button to start the
wizard. Each modal step contains the name, a short effect summary, a detailed
explanation, progress, and Apply / Skip controls. Closing the modal keeps any
changes already applied. Finishing shows a short summary and allows a new run.

## System actions

Each system-wide change is executed only after its Apply button is clicked and
uses Windows elevation when required. Errors remain on the current step with a
clear message. HVCI explicitly warns that it reduces Windows protection and a
restart is needed for it to take effect.

- PCIe LPM: set AC and DC PCI Express ASPM policy to Off in the active power
  scheme.
- HVCI: set the Device Guard HVCI registry value to disabled.
- Xbox Game Bar: disable current-user Game DVR and Game Bar values.
- Game Mode: enable the current-user Windows Game Mode setting without changing
  Xbox Game Bar or Game DVR state.
- GC Buffer: read existing Rust Steam launch options, replace any existing
  `-gc.buffer` value or append one, preserving every unrelated option.

## GC Buffer policy

Use installed physical RAM: 8 GB or less -> 2048 MB, 16 GB -> 4096 MB, 32 GB
-> 6144 MB, and more than 32 GB -> 8192 MB.

## Verification

Run frontend lint/build and Rust formatting/clippy checks. No new automated
tests are added because the project instructions explicitly prohibit writing
tests unless requested.
