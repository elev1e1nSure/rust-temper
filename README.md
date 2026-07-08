# RustPatch

[![CI](https://github.com/elev1e1nSure/rust-patch/actions/workflows/ci.yml/badge.svg)](https://github.com/elev1e1nSure/rust-patch/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/elev1e1nSure/rust-patch?label=version)](https://github.com/elev1e1nSure/rust-patch/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-ffc131?logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-2021-ed7422?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Windows](https://img.shields.io/badge/platform-Windows-0078d6?logo=windows&logoColor=white)](https://www.microsoft.com/windows)

![Screenshot](docs/screenshot.png)

GUI-утилита для тонкой настройки конфигурационных файлов игры Rust.
Без правки блокнотом, без гайдов на форумах. Все популярные твики и бинды --
в одном окне.

## Возможности

**Бинды** -- просмотр и правка `keys.cfg` через интерактивную раскладку
клавиатуры. Поиск по клавишам и командам, встроенный словарь команд Rust,
подсветка конфликтов.

**Твики** -- быстрые переключатели для `client.cfg`: FPS-оптимизации,
скрытие интерфейса, настройки оружия, шаблоны развертывания и другие
параметры. Каждый твик запоминает исходное значение для корректного отката.

**Графика** -- слайдеры качества по категориям: тени, текстуры, вода,
освещение, трава, облака, сглаживание. Каждый уровень задаёт набор
предустановленных значений.

**Настройки** -- автоопределение папки игры через реестр Steam, ручной
выбор каталога.

## Установка

### Готовый бинарник

Скачайте последнюю версию со страницы
[Releases](https://github.com/elev1e1nSure/rust-patch/releases).

Доступны установщики `.exe` (NSIS) и `.msi`.

### Сборка из исходников

```bash
git clone https://github.com/elev1e1nSure/rust-patch.git
cd rust-patch
pnpm install
pnpm tauri build
```

## Использование

```bash
pnpm install
pnpm tauri dev
```

При первом запуске утилита попытается найти папку с игрой автоматически.
Если автоопределение не сработало -- укажите путь вручную на странице
настроек.

## Стек

- **Frontend**: React 19, TypeScript 5.8, Vite 7, @mingcute/react
- **Backend**: Rust, Tauri 2, serde
- **Tooling**: pnpm, ESLint (flat config), Prettier, cargo clippy, rustfmt
- **CI/CD**: GitHub Actions (check на каждом пуше, сборка релиза по тегу `v*`)

## Лицензия

[MIT](./LICENSE)
