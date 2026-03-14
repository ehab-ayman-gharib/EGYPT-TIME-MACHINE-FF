---
description: Comprehensive setup for professional borderless photo printing (e.g., DNP DP-QW410) in Electron on macOS
---

# Professional Borderless Photo Printing Workflow (macOS)

This workflow describes the verified method for achieving reliable, full-bleed, borderless 4x6 photo printing on professional printers like the **DNP DP-QW410** or **Canon SELPHY** from an Electron application on macOS.

## 1. Image Composition (Renderer)

To ensure the highest print quality and correct aspect ratio, the image should be generated at 300 DPI for a 4x6 inch print. This step is identical to the Windows workflow.

- **Canvas Dimensions**: 1800 x 2700 pixels (Portrait) or 2700 x 1800 pixels (Landscape).
- **Format**: `image/jpeg` or `image/png`. Jpeg is generally faster for transmission, but PNG ensures no compression artifacts.

Example implementation in a service:
```typescript
canvas.width = 1800;
canvas.height = 2700;
// ... draw logic ...
const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
```

## 2. macOS Printer Preferences (Manual)

Before printing, the physical printer driver must be configured for borderless mode. This only needs to be done once per machine.

1. Open **System Settings > Printers & Scanners**.
2. Select the printer (e.g., **DP-QW410**).
3. Click on the printer name to open its details.
4. If available, click on **Printer Options** or **Manage**.
5. Often on macOS, borderless settings are handled via the CUPS interface or specific driver settings.
   - You can access the CUPS interface by navigating to `http://localhost:631` in your browser.
   - Go to **Printers > [Your Printer] > Administration > Set Default Options**.
   - Look for **"Border"** or **"Layout"** settings and ensure **"Borderless"** is selected.
   - Set the default media size to **4x6**.

## 3. Native Print Engine (Main Process)

Electron's `webContents.print()` often introduces unwanted margins. On macOS, the most robust method is using the native `lp` command line tool, which interacts directly with the CUPS printing system.

- **Engine**: `lp` (Line Printer)
- **Logic**: Save the image to a temporary file and invoke the `lp` command with specific options.

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

            // Command for macOS lp
            // -d: Destination printer
            // -o fit-to-page: Scales image to fit the media
            // -o PageSize=dnp4x6: Sets the specific media size for DNP QW410
            const command = `lp -d "${printerName}" -o fit-to-page -o PageSize=dnp4x6 "${tempPath}"`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('Print failed:', stderr);
                    resolve({ success: false, failureReason: error.message });
                    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(e) {}
                    return;
                }
                
                // Return success immediately to UI
                resolve({ success: true });
                
                // Delay cleanup
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

- **"lp: Error - no destination"**: Ensure the `printerName` matches exactly the queue name in CUPS (`lpstat -p` to list).
- **"Selected paper size is not compatible"**: This usually means you are sending a generic size (e.g., `media=4x6`) that the driver doesn't recognize. Use `lpoptions -p [Printer] -l` to find the exact option name (e.g., `PageSize/Media Size: dnp4x6`) and use that instead (e.g., `-o PageSize=dnp4x6`).
- **Margins appearing**: Check the CUPS defaults (`http://localhost:631`). Ensure the default paper size is set to the borderless variant if available. For DNP QW410, `dnp4x6` is typically borderless by design.
- **Wrong Media Size**: if `dnp4x6` doesn't work, run `lpoptions -p "Printer_Name" -l` in terminal to list available options and find the correct media key.
