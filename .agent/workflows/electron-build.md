---
description: Steps to integrate Electron and build a Windows Portable EXE for Vite-based web apps.
---

# Electron Windows Build Workflow

Follow these steps to successfully add Electron to a Vite project and generate a portable Windows executable.

## 1. Prerequisites & Installation

Install the necessary dependencies for Electron and building.

// turbo
```powershell
npm install --save-dev electron electron-builder cross-env wait-on
npm install electron-is-dev
```

## 2. Vite Configuration
Ensure assets load correctly in Electron's `file://` protocol by setting a relative base path.

- Edit `vite.config.ts`:
  ```typescript
  export default defineConfig({
    base: './', // CRITICAL: Must be relative
    // ... rest of config
  });
  ```

## 3. Electron Main Script
Create `electron/main.cjs` (using `.cjs` for CommonJS compatibility).

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        fullscreen: true,
        autoHideMenuBar: true,
    });

    const isDevEnv = !app.isPackaged;

    if (isDevEnv) {
        win.loadURL('http://localhost:3000');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
```

## 4. Package.json Configuration
Add the entry point, scripts, and build configuration.

- **Fields to add**:
  - `"main": "electron/main.cjs"`
  - `"description": "Your App Description"`
  - `"author": "Your Name"`

- **Scripts**:
  ```json
  "scripts": {
    "electron:dev": "cross-env NODE_ENV=development wait-on http://localhost:3000 && electron .",
    "electron:build": "npm run build && electron-builder"
  }
  ```

- **Build Config**:
  ```json
  "build": {
    "appId": "com.yourbound.app",
    "productName": "App Name",
    "directories": { "output": "release" },
    "files": ["dist/**/*", "electron/**/*"],
    "win": {
      "target": "portable",
      "icon": "public/icon.png"
    }
  }
  ```

## 5. Asset Path Enforcement (CRITICAL)
Electron cannot resolve absolute paths starting with `/`. 

- **Rule**: All asset references in `.tsx`, `.ts`, and `.html` files must use relative paths.
- **Example**: Change `/models/face` to `./models/face`.
- **Example**: Change `/video.mp4` to `./video.mp4`.

## 6. Building the App

1. **Close any running instances** of the app (to avoid "Access Denied" errors).
2. **Clean previous builds**: `Remove-Item -Path release -Recurse -Force`
3. **Run build**:
// turbo
```powershell
npm run electron:build
```

## Troubleshooting
- **White Screen**: Usually caused by absolute paths or an `importmap` in `index.html`. Remove `importmap` and use standard bundling.
- **Access Denied**: The app is still running in the background. Use `taskkill /F /IM "Your App.exe" /T`.
- **Icon Error**: `electron-builder` requires icons to be at least 256x256 pixels.
