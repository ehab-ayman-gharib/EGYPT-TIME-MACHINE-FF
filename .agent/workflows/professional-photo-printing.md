---
description: Comprehensive setup for professional borderless photo printing (e.g., DNP DP-QW410) in Electron
---

# Professional Borderless Photo Printing Workflow

This workflow describes the verified method for achieving reliable, full-bleed, borderless 4x6 photo printing on professional printers like the **DNP DP-QW410** or **Canon SELPHY** from an Electron application on Windows.

## 1. Image Composition (Renderer)

To ensure the highest print quality and correct aspect ratio, the image should be generated at 300 DPI for a 4x6 inch print.

- **Canvas Dimensions**: 1800 x 2700 pixels (Portrait) or 2700 x 1800 pixels (Landscape).
- **Format**: `image/jpeg` or `image/png`. Jpeg is generally faster for transmission, but PNG ensures no compression artifacts.

Example implementation in a service:
```typescript
canvas.width = 1800;
canvas.height = 2700;
// ... draw logic ...
const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
```

## 2. Windows Printer Preferences (Manual)

Before printing, the physical printer driver must be configured for borderless mode. This only needs to be done once per machine.

1. Open **Settings > Bluetooth & devices > Printers & scanners**.
2. Select the printer (e.g., **DP-QW410**).
3. Click **Printing Preferences**.
4. In the **Option** or **Layout** tab, ensure **"Border"** or **"Borderless"** is set to **Off** (or the respective borderless setting for your driver).
5. Set the default paper size to **4x6**.

## 3. Native Print Engine (Main Process)

Electron's `webContents.print()` often introduces unwanted margins or fails with professional drivers. The most robust method is using the native Windows Shell Image Print engine.

- **Engine**: `shimgvw.dll,ImageView_PrintTo`
- **Logic**: Save the image to a temporary file and invoke the engine via `rundll32`.

### Implementation in `electron/main.cjs`:

```javascript
ipcMain.handle('print-image', async (event, { imageSrc, printerName }) => {
    const os = require('os');
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    return new Promise((resolve) => {
        try {
            const tempDir = os.tmpdir();
            const tempPath = path.join(tempDir, `photo-print-${Date.now()}.png`);
            
            // Save base64 to temp file
            const base64Data = imageSrc.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));

            // Command for Shell Print Engine (ImageView_PrintTo)
            // This engine handles scaling and borderless printing significantly better than mspaint
            const command = `rundll32.exe C:\\WINDOWS\\system32\\shimgvw.dll,ImageView_PrintTo /pt "${tempPath}" "${printerName}"`;

            exec(command, (error) => {
                // Return success immediately to UI
                resolve({ success: true });
                
                // Delay cleanup (e.g., 10s) to ensure the Windows spooler is finished reading the file
                setTimeout(() => {
                    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(e) {}
                }, 10000);
            });
        } catch (err) {
            resolve({ success: false, failureReason: err.message });
        }
    });
});
```

## 4. Troubleshooting

- **Job stuck in queue**: Ensure the printer name matches exactly. Use a fuzzy search helper if needed.
- **Printed too small**: Verify the canvas is at least 1200x1800 (preferably 1800x2700) and the Printer Preferences "Border" is turned Off.
- **Wrong Orientation**: `shimgvw.dll` usually automatically rotates the image to match the paper orientation. If not, rotate the canvas in the renderer process before sending.
