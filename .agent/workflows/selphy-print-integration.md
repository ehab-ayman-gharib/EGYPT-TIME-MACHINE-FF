---
description: Integration of Canon SELPHY CP Photobooth Printing Logic
---

# Canon SELPHY Printing Integration Guide

Use this workflow to implement high-quality, borderless 4x6 (100x148mm) printing for Electron-based photobooth applications. This integration ensures correct scaling, aspect ratio preservation, and avoids "white borders" or cropping issues.

## 1. Setup the Printer Selection Logic (Renderer Process)

In your result or gallery component, implement a printer selection UI and persistent configuration.

### Create `printer-config.json`
Store this file in the `resources` or root folder for easier deployment.
```json
{
  "printerName": "Canon SELPHY CP1300"
}
```

### Implement Printer Selection
- Use `ipcRenderer.invoke('get-printers')` to fetch available system printers.
- Allow the user to select and save a default printer name to the config file (or `localStorage`).

## 2. Implement the Print Handler (Main Process)

The core logic resides in `electron/main.cjs`. This uses a hidden background window to render an exact-size HTML template.

```javascript
ipcMain.handle('print-image', async (event, { imageSrc, printerName }) => {
    return new Promise((resolve) => {
        const printWindow = new BrowserWindow({ show: false });

        // IMPORTANT: Exact dimensions for Canon SELPHY (100mm x 148mm)
        const htmlContent = `
            <html>
                <head>
                    <style>
                        @page { size: 100mm 148mm; margin: 0; }
                        body, html { 
                            margin: 0; padding: 0; 
                            width: 100mm; height: 148mm; 
                            overflow: hidden; 
                            background-color: white; 
                            display: flex; justify-content: center; align-items: center;
                        }
                        img { 
                            max-width: 100%; max-height: 100%; 
                            object-fit: contain; /* Matches "Shrink to Fit" */
                            display: block;
                        }
                    </style>
                </head>
                <body>
                    <img src="${imageSrc}" />
                </body>
            </html>
        `;

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        printWindow.webContents.on('did-finish-load', () => {
            const printOptions = {
                silent: true,
                printBackground: true,
                deviceName: printerName || '',
                margins: { marginType: 'none' },
                pageSize: { width: 100000, height: 148000 }, // 100mm x 148mm in microns
                landscape: false
            };

            printWindow.webContents.print(printOptions, (success, failureReason) => {
                printWindow.close();
                resolve({ success, failureReason });
            });
        });
    });
});
```

## 3. Design the Photo Design (Safety Areas)

Physical printers often cut off 2-5% of the edges (bleed area). When designing your logos/stamps in your `StampService`, follow these safety guidelines:

- **Padding**: Use at least **5% to 8%** padding for all critical elements (logos, text).
- **Aspect Ratio**: The standard Canon SELPHY P-size paper is **2:3**. Ensure your canvas matches this ratio to minimize scaling issues.
- **Example Padding Code**:
```typescript
const padding = canvas.width * 0.05; // 5% Safe Margin
// For bottom stamps, lift slightly higher (e.g., * 1.6) to avoid edge cropping
const y = canvas.height - stampHeight - (padding * 1.6); 
```

## 4. Troubleshooting Checklist

1. **Wait for Load**: Always trigger `webContents.print()` inside the `did-finish-load` event.
2. **Printer Name**: Ensure the `deviceName` perfectly matches the Windows Printer Spooler name.
3. **Paper Settings**: Ensure the physical printer tray is set to **Postcard (P)** size and the driver is set to **100x148mm**.
4. **Transparent PNGs**: If icons look jagged or black, ensure `printBackground: true` is set in headers and `printOptions`.
