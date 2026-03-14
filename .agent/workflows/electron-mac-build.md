---
description: Steps to build a macOS DMG or App for the Electron project.
---

# Electron Mac Build Workflow

This workflow describes how to generate a macOS application (DMG/App) for the project.

## 1. Prerequisites
- macOS Environment (Intel or Apple Silicon)
- Node.js installed
- Project dependencies installed (`npm install`)

## 2. Configuration Check
Ensure `package.json` has the `mac` build configuration:

```json
"build": {
  "mac": {
    "target": "dmg",
    "icon": "public/icon.png", // Recommended: Use .icns for best results
    "hardenedRuntime": true,
    "gatekeeperAssess": false
  }
}
```

## 3. Build Command
The build script `electron:build` automatically detects the current platform.

// turbo
```bash
npm run electron:build
```

## 4. Output
The build artifacts will be located in the `release/` directory:
- `release/Egypt Time Machine-x.x.x-arm64.dmg` (for Apple Silicon)
- `release/Egypt Time Machine-x.x.x.dmg` (for Intel)
- `release/mac-arm64/` (Unpacked application)

## 5. Troubleshooting
- **Code Signing**: If you see "skipped macOS application code signing", the built app may need to be Right-Click > Open to bypass Gatekeeper on other machines. proper signing requires an Apple Developer Account and certificates.
- **Permissions**: If the app crashes on launch, check `electron/main.cjs` for proper path handling (use `path.join(__dirname, ...)`).
