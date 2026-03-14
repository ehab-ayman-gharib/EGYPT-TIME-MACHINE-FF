const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const AutoLaunch = require('auto-launch');

let mainWindow = null;

// Setup auto-launch for Windows startup
// For NSIS installs, we need to construct the correct installed path
function getAutoLaunchPath() {
    const exePath = app.getPath('exe');
    console.log('[AutoLaunch] Raw executable path:', exePath);

    // Check if running from temp folder (portable extraction)
    if (exePath.toLowerCase().includes('\\appdata\\local\\temp\\')) {
        // For NSIS install, construct the expected installed path
        const installedPath = 'C:\\Program Files\\Pao Pao Holiday Booth\\Pao Pao Holiday Booth.exe';
        console.log('[AutoLaunch] Detected temp folder, using installed path:', installedPath);
        return installedPath;
    }

    return exePath;
}

const autoLaunchPath = getAutoLaunchPath();
console.log('[AutoLaunch] Using path for auto-launch:', autoLaunchPath);

const autoLauncher = new AutoLaunch({
    name: 'Pao Pao Holiday Booth',
    path: autoLaunchPath,
    isHidden: false,
});

// Enable auto-launch (only in production/packaged mode)
if (app.isPackaged) {
    console.log('[AutoLaunch] App is packaged, checking auto-launch status...');
    autoLauncher.isEnabled().then((isEnabled) => {
        console.log('[AutoLaunch] Current status:', isEnabled ? 'Enabled' : 'Disabled');
        if (!isEnabled) {
            return autoLauncher.enable().then(() => {
                console.log('[AutoLaunch] Successfully enabled - App will start on Windows boot');
            });
        } else {
            console.log('[AutoLaunch] Already enabled, no changes needed');
        }
    }).catch((err) => {
        console.error('[AutoLaunch] Error enabling auto-launch:', err);
    });
} else {
    console.log('[AutoLaunch] Running in development mode, skipping auto-launch');
}


// Get printer configuration from file
function getPrinterConfig() {
    const possiblePaths = [
        path.join(app.getAppPath(), 'printer-config.json'),
        path.join(process.cwd(), 'printer-config.json'),
        path.join(__dirname, '../printer-config.json'),
        path.join(__dirname, 'printer-config.json'),
        path.join(app.getPath('exe'), '..', 'printer-config.json'),
    ];

    for (const configPath of possiblePaths) {
        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(configData);
                console.log('[Printer] Config loaded from:', configPath);
                console.log('[Printer] Printer name:', config.printerName);
                return config;
            }
        } catch (err) {
            console.warn('[Printer] Failed to read config from:', configPath, err.message);
        }
    }

    console.log('[Printer] No config file found, using default');
    return { printerName: 'Canon SELPHY CP910 WS' };
}

// Helper function to find the best matching printer for WiFi/Network printing
function findBestPrinter(configuredName, availablePrinters) {
    // Try exact match first
    const exactMatch = availablePrinters.find(p => p.name === configuredName);
    if (exactMatch) {
        console.log('[Printer] Found exact match:', exactMatch.name);
        return exactMatch.name;
    }

    // Try case-insensitive match
    const caseInsensitiveMatch = availablePrinters.find(
        p => p.name.toLowerCase() === configuredName.toLowerCase()
    );
    if (caseInsensitiveMatch) {
        console.log('[Printer] Found case-insensitive match:', caseInsensitiveMatch.name);
        return caseInsensitiveMatch.name;
    }

    // Try fuzzy match - look for printers containing the configured name
    const fuzzyMatches = availablePrinters.filter(
        p => p.name.toLowerCase().includes(configuredName.toLowerCase()) ||
            configuredName.toLowerCase().includes(p.name.toLowerCase())
    );
    if (fuzzyMatches.length > 0) {
        console.log('[Printer] Found fuzzy match:', fuzzyMatches[0].name);
        return fuzzyMatches[0].name;
    }

    // Try matching by SELPHY keyword (for WiFi printers with different names)
    const selphyMatch = availablePrinters.find(
        p => p.name.toLowerCase().includes('selphy')
    );
    if (selphyMatch) {
        console.log('[Printer] Found SELPHY printer:', selphyMatch.name);
        return selphyMatch.name;
    }

    // Try matching by Canon keyword
    const canonMatch = availablePrinters.find(
        p => p.name.toLowerCase().includes('canon')
    );
    if (canonMatch) {
        console.log('[Printer] Found Canon printer:', canonMatch.name);
        return canonMatch.name;
    }

    // No match found, return configured name (will likely fail but provides error feedback)
    console.log('[Printer] No matching printer found, using configured:', configuredName);
    return configuredName;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            // Enable autoplay with sound
            autoplayPolicy: 'no-user-gesture-required',
        },
        fullscreen: true,
        autoHideMenuBar: true,
    });

    // Handle permission requests (camera, microphone, etc.)
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write'];
        const isAllowed = allowedPermissions.includes(permission);
        console.log('[Permission]', isAllowed ? 'Granted:' : 'Denied:', permission);
        // Call callback synchronously to avoid async listener error
        callback(isAllowed);
    });

    // Also handle permission checks
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

    // Log available printers on startup
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

// IPC Handler: Get list of available printers
ipcMain.handle('get-printers', async () => {
    if (!mainWindow) return [];
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map(p => ({ name: p.name, isDefault: p.isDefault }));
});

// IPC Handler: Get printer config and available printers (for debugging)
ipcMain.handle('get-printer-config', async () => {
    const printers = mainWindow ? await mainWindow.webContents.getPrintersAsync() : [];
    const defaultPrinter = printers.find(p => p.isDefault);

    return {
        availablePrinters: printers.map(p => p.name),
        defaultPrinter: defaultPrinter?.name || null
    };
});

// IPC Handler: Print image to Canon SELPHY (100mm x 148mm postcard)
ipcMain.handle('print-image', async (event, { imageSrc, printerName }) => {
    console.log('[Printer] Received print request');
    console.log('[Printer] Image data length:', imageSrc ? imageSrc.length : 0);
    console.log('[Printer] Printer name:', printerName);

    return new Promise((resolve) => {
        try {
            const printWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });

            // Write HTML to temp file to avoid data URL encoding issues
            const os = require('os');
            const tempPath = path.join(os.tmpdir(), 'print-temp.html');

            // EXACT DIMENSIONS for Canon SELPHY P-Size (100mm x 148mm)
            const htmlContent = `<!DOCTYPE html>
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
            object-fit: contain; display: block;
        }
        .error { color: red; font-size: 20px; }
    </style>
</head>
<body>
    <img src="${imageSrc}" onerror="this.style.display='none'; document.body.innerHTML='<div class=error>Image failed to load</div>';" />
</body>
</html>`;

            fs.writeFileSync(tempPath, htmlContent, 'utf-8');
            const fileStats = fs.statSync(tempPath);
            console.log('[Printer] ========================================');
            console.log('[Printer] Temp HTML file created successfully');
            console.log('[Printer] Absolute path:', path.resolve(tempPath));
            console.log('[Printer] File size:', fileStats.size, 'bytes');
            console.log('[Printer] Connection type:', printerName.includes('WS') || printerName.includes('WiFi') ? 'WiFi/Network' : 'USB/Direct');
            console.log('[Printer] ========================================');

            printWindow.loadFile(tempPath);

            printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                console.error('[Printer] Failed to load:', errorCode, errorDescription);
                printWindow.close();
                resolve({ success: false, failureReason: errorDescription });
            });

            printWindow.webContents.on('did-finish-load', () => {
                console.log('[Printer] Print window loaded successfully');

                const printOptions = {
                    silent: true,
                    printBackground: true,
                    deviceName: printerName || '',
                    margins: { marginType: 'none' },
                    pageSize: { width: 100000, height: 148000 },
                    landscape: false
                };

                console.log('[Printer] Print options:', printOptions);
                console.log('[Printer] Sending to printer...');

                printWindow.webContents.print(printOptions, (success, failureReason) => {
                    console.log('[Printer] Print result - Success:', success);
                    if (!success) {
                        console.error('[Printer] Print failed:', failureReason);
                    }
                    printWindow.close();
                    resolve({ success, failureReason });
                });
            });
        } catch (err) {
            console.error('[Printer] Exception:', err);
            resolve({ success: false, failureReason: err.message });
        }
    });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
