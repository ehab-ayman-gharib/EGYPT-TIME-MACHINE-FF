const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            autoplayPolicy: 'no-user-gesture-required',
        },
        fullscreen: true,
        autoHideMenuBar: true,
    });

    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write'];
        const isAllowed = allowedPermissions.includes(permission);
        console.log('[Permission]', isAllowed ? 'Granted:' : 'Denied:', permission);
        callback(isAllowed);
    });

    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write'];
        return allowedPermissions.includes(permission);
    });

    const isDevEnv = !app.isPackaged;

    if (isDevEnv) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.webContents.on('did-finish-load', async () => {
        console.log('[Startup] Application loaded');
        try {
            const printers = await mainWindow.webContents.getPrintersAsync();
            console.log('[Startup] Available printers:', printers.length);
            printers.forEach((printer, index) => {
                console.log(`[Startup] Printer ${index + 1}:`, {
                    name: printer.name,
                    isDefault: printer.isDefault,
                    status: printer.status
                });
            });
        } catch (err) {
            console.error('[Startup] Failed to get printers:', err);
        }
    });
}

// Get printer configuration
function getPrinterConfig() {
    const configPath = app.isPackaged
        ? path.join(process.resourcesPath, 'printer-config.json')
        : path.join(__dirname, '../printer-config.json');

    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const parsedConfig = JSON.parse(configData);

            // Resolve printer name based on platform
            // Supports { "win32": "...", "darwin": "..." } or legacy { "printerName": "..." }
            const platform = process.platform;
            let printerName = parsedConfig[platform];

            if (!printerName) {
                printerName = parsedConfig.printerName || "";
            }

            console.log(`[Printer] Config loaded for ${platform}:`, printerName);
            return { printerName };
        }
    } catch (err) {
        console.warn('[Printer] Failed to read config:', err.message);
    }

    return { printerName: "" };
}

// Helper function to find the best matching printer 
function findBestPrinter(configuredName, availablePrinters) {
    if (!configuredName) return "";

    const exactMatch = availablePrinters.find(p => p.name === configuredName);
    if (exactMatch) {
        console.log('[Printer] Found exact match:', exactMatch.name);
        return exactMatch.name;
    }

    const caseInsensitiveMatch = availablePrinters.find(
        p => p.name.toLowerCase() === configuredName.toLowerCase()
    );
    if (caseInsensitiveMatch) {
        console.log('[Printer] Found case-insensitive match:', caseInsensitiveMatch.name);
        return caseInsensitiveMatch.name;
    }

    const fuzzyMatches = availablePrinters.filter(
        p => p.name.toLowerCase().includes(configuredName.toLowerCase()) ||
            configuredName.toLowerCase().includes(p.name.toLowerCase())
    );
    if (fuzzyMatches.length > 0) {
        console.log('[Printer] Found fuzzy match:', fuzzyMatches[0].name);
        return fuzzyMatches[0].name;
    }

    const photoMatch = availablePrinters.find(
        p => p.name.toLowerCase().includes('selphy') ||
            p.name.toLowerCase().includes('dnp') ||
            p.name.toLowerCase().includes('qw410')
    );
    if (photoMatch) {
        console.log('[Printer] Found likely photo printer:', photoMatch.name);
        return photoMatch.name;
    }

    return configuredName;
}

// Get list of printers
ipcMain.handle('get-printers', async () => {
    console.log('[Electron] get-printers IPC called');
    try {
        const win = BrowserWindow.getAllWindows()[0];
        if (!win) {
            console.error('[Electron] No window found for getting printers');
            return { printers: [], config: { printerName: "" } };
        }
        const printers = await win.webContents.getPrintersAsync();
        const config = getPrinterConfig();

        const enhancedPrinters = printers.map(p => ({
            name: p.name,
            isDefault: p.isDefault,
            status: p.status
        }));

        console.log('[Electron] Available printers:', enhancedPrinters.map(p => p.name));
        return { printers: enhancedPrinters, config };
    } catch (error) {
        console.error('[Electron] Error getting printers:', error);
        return { printers: [], config: { printerName: "" } };
    }
});

// Handle Print Requests - Native Windows Print (bypassing HTML rendering)
ipcMain.handle('print-image', async (event, { imageSrc, printerName }) => {
    console.log('[Printer] Received print request');
    console.log('[Printer] Image data length:', imageSrc ? imageSrc.length : 0);
    console.log('[Printer] Target printer:', printerName);

    return new Promise(async (resolve) => {
        const os = require('os');
        const { exec } = require('child_process');
        let tempImagePath = null;

        try {
            // 1. Save the image to a temporary file
            const tempDir = os.tmpdir();
            tempImagePath = path.join(tempDir, `photo-print-${Date.now()}.png`);

            if (imageSrc.startsWith('data:')) {
                const base64Data = imageSrc.replace(/^data:image\/\w+;base64,/, '');
                fs.writeFileSync(tempImagePath, Buffer.from(base64Data, 'base64'));
                console.log('[Printer] Saved image to:', tempImagePath);
            } else {
                console.error('[Printer] Image source is not a data URL');
                resolve({ success: false, failureReason: 'Invalid image format' });
                return;
            }

            // 2. Use Windows Shell Image Print engine
            // This engine handles scaling and borderless printing much better than mspaint
            // 2. Platform-specific Print Command
            let printCommand;

            if (process.platform === 'win32') {
                // Windows: Use Shell Image Print engine
                printCommand = `rundll32.exe C:\\WINDOWS\\system32\\shimgvw.dll,ImageView_PrintTo /pt "${tempImagePath}" "${printerName}"`;
            } else if (process.platform === 'darwin') {
                // macOS: Use lp command
                // -d: destination printer
                // -o fit-to-page: scale to fit
                // -o PageSize=dnp4x6: set specific paper size for DNP QW410
                printCommand = `lp -d "${printerName}" -o fit-to-page -o PageSize=dnp4x6 "${tempImagePath}"`;
            } else {
                // Linux/Other: Basic lp command
                printCommand = `lp -d "${printerName}" -o fit-to-page "${tempImagePath}"`;
            }

            console.log('[Printer] Executing Print command:', printCommand);

            exec(printCommand, (error, stdout, stderr) => {
                console.log('[Printer] Print command completed');

                if (error) {
                    console.error('[Printer] Print command error:', error);
                    console.error('[Printer] stderr:', stderr);

                    // Cleanup
                    try {
                        if (tempImagePath && fs.existsSync(tempImagePath)) {
                            fs.unlinkSync(tempImagePath);
                        }
                    } catch (e) { }

                    resolve({ success: false, failureReason: error.message });
                } else {
                    console.log('[Printer] Print command successful');
                    console.log('[Printer] stdout:', stdout);

                    // Cleanup after a delay
                    setTimeout(() => {
                        try {
                            if (tempImagePath && fs.existsSync(tempImagePath)) {
                                fs.unlinkSync(tempImagePath);
                                console.log('[Printer] Cleaned up temp file');
                            }
                        } catch (e) { }
                    }, 10000); // Increased delay to 10s for consistency

                    resolve({ success: true });
                }
            });

        } catch (err) {
            console.error('[Printer] Exception in print handler:', err);

            // Cleanup
            try {
                if (tempImagePath && fs.existsSync(tempImagePath)) {
                    fs.unlinkSync(tempImagePath);
                }
            } catch (e) { }

            resolve({ success: false, failureReason: err.message });
        }
    });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
