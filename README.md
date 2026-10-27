# AsterNeko Launcher

> A modern, high-performance Minecraft launcher built with Tauri 2, React 19, and Rust.

[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org)

---

## Features

- **Multi-Version Management** — Install and manage multiple Minecraft versions (release, snapshot, vanilla, or modded)
- **Mod Loader Support** — Fabric, Quilt, NeoForge, and Forge with version auto-detection
- **Microsoft OAuth Login** — Secure authentication via Microsoft account
- **Download Acceleration** — Built-in aria2c integration for fast, parallel downloads
- **JVM Auto-Detection** — Automatic scanning of installed Java runtimes with manual override
- **Instance Management** — Create, delete, and organize game instances with isolated directories
- **Resource Management** — Manage mods, datapacks, resource packs, shader packs, and save files
- **File Verification** — Verify game file integrity after installation
- **Localized UI** — English and Simplified Chinese (i18next)
- **Borderless Window** — Custom title bar with native Windows look
- **Deep Link Support** — `asterneko://` protocol handler for external launcher integration

---

## Tech Stack

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 6 |
| Bundler | Vite 8 |
| Routing | React Router v7 |
| Styling | Tailwind CSS 4 + shadcn/ui + Radix UI |
| i18n | i18next + react-i18next |
| HTTP | `@muoceon/http-core`, `@muoceon/oauth-client` |

### Backend (Rust / Tauri)

| Module | Description |
|--------|-------------|
| `auth` | Microsoft OAuth flow |
| `bridge` | Internal bridge server |
| `download` | aria2c manager, manifest fetching, version/loader installation |
| `instance` | Instance CRUD and file operations |
| `jvm` | JVM scanning and version detection (Windows Registry + filesystem) |
| `launch` | Game process spawning with JVM arguments |
| `resources` | Mods, datapacks, resource packs, shader packs, saves management |
| `verify` | SHA1/asset integrity verification |

---

## Prerequisites

| Tool | Minimum Version | Required For |
|------|----------------|--------------|
| [Rust](https://rustup.rs) | 1.70+ | Tauri backend |
| [Bun](https://bun.sh) | 1.x | Package management & scripts |
| [Node.js](https://nodejs.org) | 20+ | (optional, Bun covers it) |
| [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) | 2022 | Windows: C++ build tools for Tauri |

> **Windows users**: Ensure "Desktop development with C++" workload is installed in Visual Studio Build Tools.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/muoceon/asterneko-launcher.git
cd asterneko-launcher
```

### 2. Install dependencies

```bash
bun install
```

### 3. Run in development mode

```bash
bun run tauri dev
```

This starts the Vite dev server on `http://localhost:1420` and opens the Tauri window.

### 4. Build for production

```bash
bun run tauri build
```

The installer will be output to `src-tauri/target/release/bundle/`.

---

## Project Structure

```
asterneko-launcher/
├── public/                   # Static assets
├── src/                      # React frontend
│   ├── components/           # UI components
│   │   ├── download/         # Download queue, mod/version/shader tabs
│   │   ├── features/         # ResponsiveSheetMenu, locale, theme
│   │   ├── instance/         # Instance detail, login, pre-launch checks
│   │   ├── layout/           # Layout, Nav, Sidebar, StatusBar, Logo
│   │   └── ui/               # shadcn/ui primitives
│   ├── config/               # API, i18n, OAuth configs
│   ├── contexts/             # React contexts (TaskManager)
│   ├── hooks/                # Custom hooks
│   ├── i18n/                 # Translation files (en / zh-Hans)
│   ├── lib/                  # Utilities and settings
│   ├── pages/                # Page components (Home, Download, Instances, Settings, etc.)
│   ├── routes/               # Router configuration
│   ├── shared/               # Shared modules (code-mapper, kernel utils)
│   ├── App.tsx               # Root app component
│   └── main.tsx              # Entry point
├── src-tauri/                # Rust backend
│   ├── bin/aria2c.exe        # Bundled aria2c binary
│   ├── src/
│   │   ├── auth/             # Microsoft OAuth implementation
│   │   ├── bridge/           # Internal server bridge
│   │   ├── download/         # Download engine (aria2, manifest, loader, install)
│   │   ├── instance/         # Instance management
│   │   ├── jvm/              # JVM detection and scanning
│   │   ├── launch/           # Game launcher
│   │   ├── resources/        # Resource pack / mod / save managers
│   │   ├── verify/           # File integrity verification
│   │   ├── lib.rs            # Tauri commands & app state
│   │   └── main.rs           # Entry point
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
├── package.json
├── vite.config.ts
└── README.md
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server only (port 1420) |
| `bun run build` | Type-check and build frontend |
| `bun run preview` | Preview production build locally |
| `bun run tauri dev` | Start full Tauri dev environment |
| `bun run tauri build` | Build production installer |

---

## .gitignore Summary

The project ignores:

- `node_modules`, `dist`, `dist-ssr`
- `*.local` files
- `.vscode/` (except `extensions.json`)
- `.idea`, `.DS_Store`
- `src-tauri/target/` (Rust build artifacts)
- Generated Tauri schema files (`src-tauri/gen/schemas`)

---

## Contributing

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `master` | Stable, production-ready code |
| `dev` | Active development branch |
| `feature/*` | New features (branch from `dev`) |
| `fix/*` | Bug fixes (branch from `dev`) |
| `release/*` | Release preparation |

### Workflow

1. **Fork & Clone**
   ```bash
   git clone https://github.com/your-username/asterneko-launcher.git
   cd asterneko-launcher
   git remote add upstream https://github.com/muoceon/asterneko-launcher.git
   ```

2. **Create a Branch**
   ```bash
   git checkout dev
   git pull upstream dev
   git checkout -b feature/my-awesome-feature
   ```

3. **Make Changes**
   - Follow existing code style (Rust: `rustfmt`, TypeScript: Prettier/ESLint)
   - Write meaningful commit messages
   - Keep changes focused and atomic

4. **Test Your Changes**
   ```bash
   bun run tauri dev     # Full E2E test
   cargo test            # Rust unit tests (if any)
   bun run build         # Ensure build succeeds
   ```

5. **Commit**
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```

   Commit message format: `type: description`
   | Type | Usage |
   |------|-------|
   | `feat` | New feature |
   | `fix` | Bug fix |
   | `refactor` | Code restructuring |
   | `docs` | Documentation |
   | `style` | Formatting, missing semicolons |
   | `perf` | Performance improvement |
   | `test` | Adding tests |
   | `chore` | Maintenance tasks |

6. **Push & Create PR**
   ```bash
   git push origin feature/my-awesome-feature
   ```
   Then open a Pull Request against `muoceon/asterneko-launcher:dev`.

### Code Style

- **Rust**: Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/). Use `cargo fmt` and `cargo clippy`.
- **TypeScript**: ESLint with `eslint-config-next` + Prettier. Run `bun run lint` and `bun run format`.
- **Naming**: Use descriptive names. React components use PascalCase, hooks use `use` prefix, Rust follows `snake_case`.
- **Structure**: Place shared logic in `shared/`, page-specific logic co-located with pages.

### Pull Request Guidelines

- PR title should follow commit message convention
- Include a clear description of what and why
- Reference related issues with `Closes #123`
- Ensure CI passes before requesting review
- Keep PRs small and focused — one feature/fix per PR

---

## Architecture Notes

### Tauri Commands

All backend functionality is exposed via `#[tauri::command]` and called from the frontend using `@tauri-apps/api`. Key commands:

| Command | Module | Description |
|---------|--------|-------------|
| `scan_jvm` | `jvm::scan` | Scan system for Java installations |
| `fetch_version_manifest` | `download::manifest` | Get available MC versions |
| `install_version` | `download::install` | Download and install a version |
| `list_instances` | `instance` | List all game instances |
| `launch_game` | `launch` | Start Minecraft process |
| `verify_instance` | `verify` | Check file integrity |

### State Management

- **Frontend**: React Context (`TaskManagerContext`) + custom hooks
- **Backend**: `tauri::State<Mutex<T>>` for thread-safe shared state (bridge port, running game process)
- **Aria2c**: Managed as a Tauri state singleton (`Aria2Manager`)

### Security

- CSP is disabled (`null`) for development flexibility — should be tightened for production
- Microsoft OAuth uses official MSAL endpoints
- All download URLs are validated against official Mojang/Fabric/Forge sources

---

## License

[MIT](LICENSE)

---

## Links

- [Official Website](https://asternneko.muoceon.com)
- [Issue Tracker](https://github.com/muoceon/asterneko-launcher/issues)
- [Tauri Documentation](https://tauri.app)
- [MuoCeon](https://github.com/muoceon)