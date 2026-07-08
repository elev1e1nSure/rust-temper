# RustPatch

[![CI](https://github.com/elev1e1nSure/rust-patch/actions/workflows/ci.yml/badge.svg)](https://github.com/elev1e1nSure/rust-patch/actions/workflows/ci.yml)

**GUI-утилита для управления конфигурационными файлами игры Rust.**

## Quick Start

```bash
pnpm install && pnpm tauri dev
```

## Controls

- **Бинды** — просмотр и редактирование `keys.cfg`: интерактивная раскладка клавиатуры, поиск по клавишам/командам, предустановленный словарь команд Rust, проверка конфликтов биндов.
- **Твики** — быстрые переключатели для `client.cfg`: FPS-оптимизации, скрытие интерфейса, настройки оружия, шаблон развертывания и другие популярные параметры. Каждый твик сохраняет исходное значение для корректного отката.
- **Графика** — слайдеры качества: тени, текстуры, вода, освещение, трава, облака, сглаживание. Каждый уровень — набор предустановленных значений ключей `client.cfg`.
- **Настройки** — автоопределение папки игры через реестр Steam, ручной выбор каталога.

## Project Structure

```
src/                  # React TypeScript frontend
  App.tsx             # корневой компонент, роутинг по страницам
  hooks/              # useConfigFile, useBindEditor, useTweaks, useSidebarResize
  pages/              # BindsPage, TweaksPage, GraphicsPage, SettingsPage
  utils/              # paths.ts — client.cfg путь из известного keys.cfg
src-tauri/            # Rust backend
  src/
    lib.rs            # Tauri entry, все #[tauri::command] регистрируются здесь
    client_cfg.rs     # парсинг/запись client.cfg через write_atomic + operation_lock
    tweaks.rs         # логика переключения твиков, TweakTx с откатом
    tweak_state.rs    # персистентное состояние твиков (tweak-state.json)
    tweak_defs.rs     # статический каталог определений твиков
    graphics.rs       # слайдеры качества — Quality дескрипторы + tiers + ReadSpec
    keys_cfg.rs       # парсинг/запись keys.cfg (bind <key> <command>)
    known_commands.rs # словарь команд Rust для автодополнения
    rust_locator/     # автоопределение пути Steam через реестр + libraryfolders.vdf
```

## Stack

- **Frontend**: React 19, TypeScript, Vite 7, @mingcute/react (иконки)
- **Backend**: Rust, Tauri v2, serde
- **Tooling**: pnpm, ESLint flat config, Prettier, cargo clippy/rustfmt
