# Glossary

[![CI](https://github.com/sephirxxxz/epub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sephirxxxz/epub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2f6f95.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-111827.svg)](https://github.com/sephirxxxz/epub/releases)
[![Tauri 2](https://img.shields.io/badge/shell-Tauri%202-24c8db.svg)](https://tauri.app/)

A lightweight, offline-first macOS EPUB reader for English books. Click a word to reveal and persist a short Chinese gloss beneath the original text; double-click it to inspect the detailed local dictionary entry.

> [!IMPORTANT]
> Glossary is designed for DRM-free, reflowable EPUB files. It does not provide cloud sync, network translation, telemetry, PDF support, or DRM bypass.

## What's included in v0.1.0

- Local library and reading-progress model
- Persistent annotations stored separately from the original EPUB
- Single-click quick gloss interaction
- Double-click detail card interaction
- Bundled 30,000-entry ECDICT-derived offline English–Chinese dictionary
- Rust/Tauri security helpers for EPUB filename and archive-member validation
- A native Apple Silicon macOS DMG bundle

## Quick start

### Run the web shell

```bash
npm install
npm run dev
```

The development shell uses IndexedDB for EPUB bytes and localStorage for the prototype catalog and annotations.

### Build and test the frontend

```bash
npm run build
npm test
```

### Build the native macOS app

Install the prerequisites first:

- macOS with Xcode Command Line Tools
- Node.js and npm
- Rust stable with the `aarch64-apple-darwin` target

Then run:

```bash
npm install
npm run tauri build
```

The command runs the frontend production build, compiles the Rust host, and creates an Apple Silicon DMG at:

```text
src-tauri/target/release/bundle/dmg/Glossary_0.1.0_aarch64.dmg
```

## Install on macOS

1. Open the DMG.
2. Drag `Glossary.app` to `Applications`.
3. Open `Glossary` from Applications.
4. If macOS warns that the app is from an unidentified developer, Control-click the app, choose **Open**, and confirm.

The local build is unsigned and not notarized. A signed release needs an Apple Developer certificate, provisioning setup, and notarization credentials.

## Product principles

1. Never modify the user's original EPUB.
2. Never send book text to a network service in offline mode.
3. Mark failed CFI restoration as orphaned rather than attaching it to the wrong word.
4. Keep click-to-gloss quiet and fast; reserve details for the double-click card.

## Repository layout

```text
src/                 React application and local data models
src-tauri/           Tauri 2 host, Rust commands, security helpers, and bundle config
tests/unit/          Vitest unit tests
.github/workflows/   Continuous integration
```

## Validation

| Check | Result |
| --- | --- |
| Unit tests | 9 tests passed across 5 files |
| TypeScript and Vite production build | Passed |
| Tauri Apple Silicon release build | Passed |
| DMG bundle | Generated |

## License

The application code is licensed under the [MIT License](LICENSE). Dictionary data is distributed separately and remains subject to its original license and attribution requirements.
