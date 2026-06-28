# Snap CameraKit Electron Integration

This workflow guide describes how to integrate the `@snap/camera-kit` Web SDK into an Electron application (React or vanilla JS). It covers specific challenges unique to Electron, such as local file protocol restrictions (`file://`), API origin whitelists, and matrix transformations for physically rotated landscape cameras in portrait kiosks.

---

## 1. Installation

Install the official CameraKit Web SDK package:
```bash
npm install @snap/camera-kit
```

---

## 2. Production Local Server Architecture

### The Problem
CameraKit Web SDK utilizes WebAssembly (WASM) and strict cross-origin policies. In production, Electron applications are traditionally served using the `file://` protocol. Running CameraKit via `file://` completely fails because:
1. WASM loading is blocked or has invalid mime-types on local directories.
2. Web APIs like `getUserMedia` or Snap’s auth services expect a secure context (`http://localhost` or `https://`).

### The Solution
In production builds, bypass `file://` by launching a minimal local HTTP server within the **Electron Main Process** (`main.js` or `main.cjs`) to serve the built static resources (e.g. from the `/dist` directory) over `127.0.0.1` on a dynamically allocated free port.

```javascript
// Inside electron/main.js
const http = require('http');
const path = require('path');
const fs = require('fs');

function createWindow(isKiosk = false) {
    const mainWindow = new BrowserWindow({
        // window configurations...
        webPreferences: {
            webSecurity: false, // Allows loading local assets if needed alongside the HTTP server
        }
    });

    const isDevEnv = !app.isPackaged;

    if (isDevEnv) {
        mainWindow.loadURL('http://localhost:3000'); // Vite dev server
    } else {
        const distDir = path.join(__dirname, '../dist');
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.mjs': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.wasm': 'application/wasm',
            '.webp': 'image/webp',
        };

        // Spin up a simple HTTP server serving static files from /dist
        const server = http.createServer((req, res) => {
            let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
            filePath = filePath.split('?')[0]; // Strip query parameters

            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    // Fallback to index.html for SPA routing
                    fs.readFile(path.join(distDir, 'index.html'), (err2, fallbackData) => {
                        if (err2) {
                            res.writeHead(404);
                            res.end('Not Found');
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(fallbackData);
                        }
                    });
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(data);
                }
            });
        });

        // Listen on an ephemeral port (0 selects an unused port)
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            console.log(`[Electron] Production HTTP server serving dist at http://127.0.0.1:${port}`);
            mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);
        });
    }
}
```

---

## 3. Bypassing Snap API Origin Whitelists

### The Problem
Snap CameraKit API tokens are bound to specific whitelisted domain strings registered in the **Snap Developer Portal** (e.g., `https://127.0.0.1` or `https://yourdomain.com`). 
Because Electron processes run locally, their web request headers defaults to the dynamic local server address (e.g. `http://127.0.0.1:54321`) which is rejected by Snap authentication with `[16] request not authenticated` gRPC errors.

### The Solution
Use Electron's `webRequest` API in the main process to intercept outgoing headers and rewrite the `Origin` and `Referer` to match a whitelisted address registered in your Snap Developer Portal (e.g., `https://127.0.0.1`).

```javascript
// Inside electron/main.js - app.whenReady()
app.whenReady().then(() => {
    const { session } = require('electron');
    const filter = { urls: ['https://*/*', 'http://*/*'] };
    const ALLOWED_ORIGIN = 'https://127.0.0.1'; // Registered whitelisted portal domain

    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        try {
            const reqUrl = details.url || '';
            // Match any Snap endpoints (WASM CDN, gRPC APIs, etc.)
            const isSnapApi = /(snapar|snapchat|snapkit|sc-cdn|sc-prod)\.(com|net)/i.test(reqUrl);
            
            if (isSnapApi) {
                details.requestHeaders['Origin'] = ALLOWED_ORIGIN;
                details.requestHeaders['Referer'] = ALLOWED_ORIGIN + '/';
            }
        } catch (e) {
            console.error('Header modification error:', e);
        }
        callback({ requestHeaders: details.requestHeaders });
    });

    createWindow();
});
```

---

## 4. Front-End Core Integration

Create a configurations file (`cameraKitConfig.ts`):
```typescript
export const CAMERAKIT_CONFIG = {
  CAMERA_KIT_API_TOKEN: "YOUR_API_TOKEN_HERE",
  LENS_GROUP_ID: "YOUR_LENS_GROUP_ID_HERE",
  LENS_ID: "YOUR_LENS_ID_HERE"
};
```

Set up your React component or vanilla DOM structure:
```tsx
import React, { useEffect, useRef } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { CAMERAKIT_CONFIG } from './cameraKitConfig';

export const CameraCapture = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!canvasRef.current) return;

      // 1. Bootstrap the CameraKit SDK
      const kit = await bootstrapCameraKit({
        apiToken: CAMERAKIT_CONFIG.CAMERA_KIT_API_TOKEN
      });
      if (!active) return;

      // 2. Create the Session
      const session = await kit.createSession({
        liveRenderTarget: canvasRef.current
      });
      if (!active) return;
      sessionRef.current = session;

      // 3. Load Lenses Group
      const group = await kit.lensRepository.loadLensGroups([CAMERAKIT_CONFIG.LENS_GROUP_ID]);
      if (!active) return;

      // 4. Find and Apply specific Lens
      const lens = group.lenses.find((l: any) => l.id === CAMERAKIT_CONFIG.LENS_ID) || group.lenses[0];
      if (lens) {
        await session.applyLens(lens);
      }

      // 5. Initialize Camera Media Stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (!active) {
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }

      // 6. Set Camera Source
      const source = createMediaStreamSource(mediaStream, { cameraType: 'user' });
      await session.setSource(source);

      // 7. Apply Physical Orientation Transform
      // (See Matrix Transform section below)
      const portraitTransform = new Transform2D([
        0, -1, 0,
        1, 0, 0,
        0, 1, 1
      ]);
      source.setTransform(portraitTransform);

      // 8. Start Playback
      session.play();
      source.setRenderSize(1080, 1920);
    };

    init();

    return () => {
      active = false;
      if (sessionRef.current) {
        sessionRef.current.pause();
        sessionRef.current.destroy();
      }
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', objectFit: 'cover' }} />;
};
```

---

## 5. Matrix Transformations (`Transform2D`) for Rotated Portrait setups

### Setup Context
In photobooth installations, cameras are often mounted **sideways** (rotated physically by 90 degrees) to capture full-body portrait shots. This means the incoming video feed (e.g. 1280x720) must be rotated 90 degrees to output upright (1080x1920). Additionally, self-facing screens must act like a **mirror** (horizontal reflection).

### The Error
If you apply a CSS reflection (e.g., `scale-x-[-1]`) on the HTML `<canvas>` container, the entire output is flipped. This mirrors all lens assets, text strings (e.g. livery logos or user interface instructions), and 3D textures, making them unreadable.

### The Correct Approach
Avoid CSS canvas mirroring. Instead, apply the mirroring **directly on the camera stream input coordinates** using the SDK's `Transform2D` matrix before it reaches the lens renderer. This ensures the background camera feed is mirrored, but all overlays/3D models are rendered normally.

#### Column-Major Matrix Formula
The `Transform2D` constructor accepts an array of 9 elements representing a 3x3 affine transformation matrix in **column-major order**.

```
[ m0  m3  m6 ]
[ m1  m4  m7 ]
[ m2  m5  m8 ]
```

To map viewport coordinates `(x_screen, y_screen)` to the camera sensor coordinates `(x_camera, y_camera)` such that the image is rotated 90 degrees and mirrored horizontally on the viewport:

$$\begin{cases} x_{camera} = y_{screen} \\ y_{camera} = 1 - x_{screen} \end{cases}$$

This translates to the following system:

$$\begin{pmatrix} x_{camera} \\ y_{camera} \\ 1 \end{pmatrix} = \begin{pmatrix} 0 & 1 & 0 \\ -1 & 0 & 1 \\ 0 & 0 & 1 \end{pmatrix} \begin{pmatrix} x_{screen} \\ y_{screen} \\ 1 \end{pmatrix}$$

Mapping this matrix to column-major array entries:
*   Column 0: `m0 = 0`, `m1 = -1`, `m2 = 0`
*   Column 1: `m3 = 1`, `m4 = 0`, `m5 = 0`
*   Column 2: `m6 = 0`, `m7 = 1`, `m8 = 1`

Yielding the array: `[0, -1, 0, 1, 0, 0, 0, 1, 1]`

```typescript
const rotate90AndMirror = new Transform2D([
  0, -1, 0,  // Col 0
  1, 0, 0,   // Col 1
  0, 1, 1    // Col 2
]);
source.setTransform(rotate90AndMirror);
```

---

## 6. Capturing Photos

To take a photo from the CameraKit feed:
1. Sample the active `<canvas>` element data stream via `toDataURL()`.
2. Convert the Base64 image payload and store it natively using Electron IPC.

```typescript
// Front-End (Renderer)
const capturePhoto = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const imageDataBase64 = canvas.toDataURL('image/jpeg', 0.95);
  // Send data to Electron Main Process to write to disk
  window.electron.savePhoto(imageDataBase64);
};
```
