# CameraKit Electron Integration Workflow

This workflow guide describes how to integrate the `@snap/camera-kit` AR lenses implementation from the Gender Classification client into an Electron-based application.

---

## 1. Prerequisites & Dependencies

Install the required packages in your Electron renderer codebase:
```bash
npm install @snap/camera-kit
```

---

## 2. Configuration Setup

Create an configuration file `src/AppConfig.ts` to manage your CameraKit API Token and Lens IDs:

```typescript
export const APP_CONFIG = {
    CAMERA_KIT_API_TOKEN: 'YOUR_CAMERA_KIT_API_TOKEN',
    LENS_GROUP_ID: 'YOUR_LENS_GROUP_ID',
    LENS_ID: 'YOUR_LENS_ID'
} as const;
```

---

## 3. UI Layer Setup (HTML / DOM Structure)

Define the structure in your renderer's HTML file (e.g., `index.html`). You need a container that holds the live AR canvas, a hidden photo preview canvas, controls, and a loading/splash overlay:

```html
<div class="app-container">
  <!-- Camera Kit Section -->
  <div id="Camera-Kit-Section" class="Camera-Kit-Section">
    <!-- Live AR Canvas -->
    <canvas id="CameraKit-AR-Canvas"></canvas>
    
    <!-- Photo Preview Canvas (Hidden by default) -->
    <canvas id="photo-preview-canvas" style="display: none;"></canvas>

    <!-- UI Action Controls -->
    <button id="capture-btn" class="capture-btn" style="display: none;"></button>
    <button id="download-btn" class="download-btn" style="display: none;"></button>
    <button id="close-btn" class="close-btn" style="display: none;"></button>
  </div>
  
  <!-- Splash Loading Screen -->
  <div id="splash-loader">
    <img src="/loading.gif" alt="Loading..." />
  </div>
</div>
```

---

## 4. CameraKit Core Integration (Renderer Process)

Implement the bootstrap, session management, lens loading, and media streaming in your TypeScript/JavaScript entry point (`main.ts`):

### 4.1 Import SDK APIs
```typescript
import {
  bootstrapCameraKit,
  CameraKitSession,
  createMediaStreamSource,
  Transform2D
} from '@snap/camera-kit';
import { APP_CONFIG } from './AppConfig';
```

### 4.2 Initialize & Load Lenses
Bootstrap CameraKit and apply lenses. Once lenses are fully loaded, dismiss the splash screen and configure the camera stream source:

```typescript
let cameraKit: any;
let cameraKitSession: CameraKitSession;
let lensesGroup: any;

const camerakitCanvas = document.getElementById('CameraKit-AR-Canvas') as HTMLCanvasElement;

async function initCameraKit() {
  let loadedLensesCount = 0;
  try {
    // 1. Bootstrap SDK
    cameraKit = await bootstrapCameraKit({ apiToken: APP_CONFIG.CAMERA_KIT_API_TOKEN });
    
    // 2. Create AR rendering session target
    cameraKitSession = await cameraKit.createSession({ liveRenderTarget: camerakitCanvas });
    
    // 3. Load Lens Groups
    lensesGroup = await cameraKit.lensRepository.loadLensGroups([APP_CONFIG.LENS_GROUP_ID]);
    
    // 4. Apply Lenses and start
    lensesGroup.lenses.forEach((lens: any) => {
      cameraKitSession.applyLens(lens).then(() => {
        loadedLensesCount++;
        if (loadedLensesCount === lensesGroup.lenses.length) {
          hideSplashLoader();
          
          // Configure video source (e.g. back camera = false, front camera = true)
          setCameraKitSource(cameraKitSession, false); 
          
          setTimeout(() => {
            setupCaptureUI();
          }, 500);
        }
      });
    });
  } catch (error) {
    console.error('Failed to initialize CameraKit:', error);
  }
}
```

### 4.3 Configure Camera Stream & Transformations
Get the media stream, wrap it in a CameraKit media stream source, and rotate/transform as required (e.g., 90-degree portrait orientation):

```typescript
let mediaStream: MediaStream;

async function setCameraKitSource(session: CameraKitSession, isFront: boolean = true) {
  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: isFront ? "user" : "environment" }
  });

  const source = createMediaStreamSource(mediaStream, {
    cameraType: isFront ? 'user' : 'environment'
  });

  await session.setSource(source);

  // Rotate 90 degrees for portrait setup
  const rotate90 = new Transform2D([
    0, 1, 0,
    1, 0, 0,
    0, 0, 1
  ]);
  source.setTransform(rotate90);

  session.play();
  source.setRenderSize(1080, 1920);
}
```

---

## 5. Capturing & Photo Management (Electron Considerations)

In a traditional web app, download is achieved via helper anchors. For Electron, you can either trigger a direct download or send the Base64 image data to the main process via IPC to save it natively.

### 5.1 Standard Canvas Capture (Renderer)
```typescript
let capturedImageData: string | null = null;

function capturePhoto() {
  if (!camerakitCanvas) return;
  
  // Capture frame as PNG Base64
  capturedImageData = camerakitCanvas.toDataURL('image/png');
  
  const photoPreviewCanvas = document.getElementById('photo-preview-canvas') as HTMLCanvasElement;
  if (photoPreviewCanvas) {
    photoPreviewCanvas.width = camerakitCanvas.width;
    photoPreviewCanvas.height = camerakitCanvas.height;

    const ctx = photoPreviewCanvas.getContext('2d');
    if (ctx) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, photoPreviewCanvas.width, photoPreviewCanvas.height);
        ctx.drawImage(img, 0, 0);

        // Display preview canvas and hide AR rendering canvas
        photoPreviewCanvas.style.display = 'block';
        camerakitCanvas.style.display = 'none';
      };
      img.src = capturedImageData;
    }
  }
}
```

### 5.2 Handling Downloads/Saves (Electron Main Process IPC Bridge)
Instead of standard browser downloads, you can save the captured photo directly to the user's filesystem:

* **Renderer Process (`renderer.ts`)**:
  ```typescript
  function savePhotoElectron() {
    if (capturedImageData) {
      // Send base64 data to Electron Main process via IPC
      window.electronAPI.saveCapturedPhoto(capturedImageData);
    }
  }
  ```

* **Preload Script (`preload.js`)**:
  ```javascript
  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('electronAPI', {
    saveCapturedPhoto: (base64Data) => ipcRenderer.send('save-photo', base64Data)
  });
  ```

* **Main Process (`main.js`)**:
  ```javascript
  const { ipcMain, dialog } = require('electron');
  const fs = require('fs');

  ipcMain.on('save-photo', async (event, base64Data) => {
    const base64Image = base64Data.replace(/^data:image\/png;base64,/, "");
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Captured Photo',
      defaultPath: `photo-${Date.now()}.png`,
      filters: [{ name: 'Images', extensions: ['png'] }]
    });

    if (filePath) {
      fs.writeFile(filePath, base64Image, 'base64', (err) => {
        if (err) console.error('Failed to save image:', err);
      });
    }
  });
  ```
