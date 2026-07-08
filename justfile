set shell := ["pwsh", "-NoProfile", "-Command"]

VERSION := env_var_or_default("VERSION", "dev")

default:
    @just --list

dev:
    pnpm tauri dev

build:
    pnpm build

typecheck:
    pnpm typecheck

lint:
    pnpm lint && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings

fmt:
    pnpm format && cargo fmt --manifest-path src-tauri/Cargo.toml

fmt-check:
    cargo fmt --manifest-path src-tauri/Cargo.toml -- --check

check: typecheck lint fmt-check build
    cargo test --manifest-path src-tauri/Cargo.toml

set-version VERSION:
    @$v = "{{VERSION}}"; echo "setting version to $v"
    @(Get-Content package.json -Raw) -replace '"version":\s*"[^"]*"', '"version": "$v"' | Set-Content package.json -NoNewline
    @(Get-Content src-tauri/Cargo.toml -Raw) -replace '^version = "[^"]*"', 'version = "$v"' | Set-Content src-tauri/Cargo.toml -NoNewline
    @(Get-Content src-tauri/tauri.conf.json -Raw) -replace '"version":\s*"[^"]*"', '"version": "$v"' | Set-Content src-tauri/tauri.conf.json -NoNewline

ci-build:
    pnpm install --frozen-lockfile
    pnpm tauri build
