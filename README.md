# RustTemper

<div align="center">

### Настрой Rust за пять минут, а не за час по гайдам

[![CI](https://github.com/elev1e1nSure/rust-temper/actions/workflows/ci.yml/badge.svg)](https://github.com/elev1e1nSure/rust-temper/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/elev1e1nSure/rust-temper?label=version)](https://github.com/elev1e1nSure/rust-temper/releases)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue)](./LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-ffc131?logo=tauri&logoColor=white)](https://tauri.app)

![Screenshot](docs/screenshot.png)

[<img src="https://img.shields.io/badge/Скачать-Последнюю_версию_для_Windows-0078d4?style=for-the-badge&logo=windows&logoColor=white" height="40">](https://github.com/elev1e1nSure/rust-temper/releases/latest)

</div>

### Rust без гайдов

Хватит собирать твики по форумам и роликам на YouTube и запоминать
консольные команды. RustTemper открывает все настройки в одном окне, с
кнопками вместо конфигов.

## Что внутри

**Бинды** — раскладка клавиатуры прямо на экране: кликаешь клавишу, вводишь
команду. Поиск, готовый словарь команд Rust и подсветка, если два бинда
конфликтуют.

**Твики** — переключатели для популярных фишек client.cfg: прирост FPS,
чистый экран без интерфейса, настройки оружия и другие штуки, которые обычно
ищут в гайдах. Выключил — всё вернулось как было.

**Графика** — вместо голых цифр в конфиге — понятные ползунки: тени,
текстуры, вода, освещение, трава, облака, сглаживание.

**Настройки** — RustTemper сам находит папку с игрой через Steam. Не нашёл —
укажешь путь вручную.

## Установка (из исходников)

```bash
git clone https://github.com/elev1e1nSure/rust-temper.git
cd rust-temper
pnpm install
pnpm tauri build
```

## Использование

```bash
pnpm install
pnpm tauri dev
```

При первом запуске утилита попытается найти папку с игрой автоматически.
Если автоопределение не сработало — укажите путь вручную на странице
настроек.

## Стек

- **Frontend**: React 19, TypeScript 5.8, Vite 7, @mingcute/react
- **Backend**: Rust, Tauri 2, serde
- **Tooling**: pnpm, ESLint (flat config), Prettier, cargo clippy, rustfmt
- **CI/CD**: GitHub Actions (check на каждом пуше, сборка релиза по тегу `v*`)

## Лицензия

[GPL-3.0](./LICENSE)
