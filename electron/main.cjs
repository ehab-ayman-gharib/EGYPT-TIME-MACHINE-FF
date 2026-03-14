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
            devTools: true, // Ensure devtools is enabled
        },
        fullscreen: false, // Set to false for easier debugging
        autoHideMenuBar: false,
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
        console.log('[Startup] App bits:', {
            isPackaged: app.isPackaged,
            appPath: app.getAppPath(),
            resourcePath: process.resourcesPath,
            execPath: process.execPath
        });
        
        // Add a global shortcut for DevTools in production
        mainWindow.on('focus', () => {
            const { globalShortcut } = require('electron');
            globalShortcut.register('CommandOrControl+Shift+I', () => {
                mainWindow.webContents.toggleDevTools();
            });
        });

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

// Get application configuration
function getAppConfig() {
    const configPath = app.isPackaged
        ? path.join(process.resourcesPath, 'printer-config.json')
        : path.join(__dirname, '../printer-config.json');

    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const parsedConfig = JSON.parse(configData);

            // Resolve printer name based on platform
            const platform = process.platform;
            let printerName = parsedConfig[platform];

            if (!printerName) {
                printerName = parsedConfig.printerName || "";
            }

            // Get Conda info and FaceFusion Directory
            const condaEnv = parsedConfig.condaEnv || "";
            const condaPath = parsedConfig.condaPath || "conda"; // Default to just 'conda'
            const facefusionDir = parsedConfig.facefusionDir || "";

            console.log(`[Config] Loaded - Printer: ${printerName}, Conda: ${condaEnv}, FF Dir: ${facefusionDir}`);
            return { printerName, condaEnv, condaPath, facefusionDir };
        }
    } catch (err) {
        console.warn('[Config] Failed to read config:', err.message);
    }

    return { printerName: "", condaEnv: "", condaPath: "conda", facefusionDir: "" };
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
        p => p.name.toLowerCase().includes('dnp') ||
            p.name.toLowerCase().includes('qw410') ||
            p.name.toLowerCase().includes('ds620') ||
            p.name.toLowerCase().includes('selphy')
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
        const { printers, config } = { printers: await win.webContents.getPrintersAsync(), config: getAppConfig() };
        console.log('[Electron] App Config:', config);

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

// Handle FaceFusion Execution
ipcMain.handle('execute-face-fusion', async (event, { sourceBase64, targetPath }) => {
    console.log('[FaceFusion] Execution requested');
    const os = require('os');
    const { exec } = require('child_process');
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    
    // Paths
    const sourcePath = path.join(tempDir, `ff_source_${timestamp}.png`);
    const outputPath = path.join(tempDir, `ff_output_${timestamp}.png`);
    
    // Ensure target path is absolute and accessible by external processes (like Python)
    // Ensure target path is absolute and accessible by external processes (like Python)
    let absoluteTargetPath = targetPath;
    let tempTargetPath = null;

    if (!path.isAbsolute(targetPath)) {
        // Find the template in the app structure
        // In production, assets are in dist (relative to this file)
        const templateSearchPath = path.resolve(__dirname, '..', app.isPackaged ? 'dist' : 'public', targetPath);

        console.log(`[FaceFusion] Searching for template: ${templateSearchPath}`);

        // If the path is inside an ASAR archive, we MUST extract it
        if (templateSearchPath.includes('.asar')) {
            tempTargetPath = path.join(tempDir, `ff_target_${timestamp}.jpg`);
            try {
                // fs.readFileSync automatically handles ASAR extraction in Electron
                const templateBuffer = fs.readFileSync(templateSearchPath);
                fs.writeFileSync(tempTargetPath, templateBuffer);
                absoluteTargetPath = tempTargetPath;
                console.log('[FaceFusion] SUCCESSFULLY extracted template to:', absoluteTargetPath);
            } catch (e) {
                console.error('[FaceFusion] FAILED to extract template from ASAR:', e.message);
                // Fallback to search path (will likely fail in Python)
                absoluteTargetPath = templateSearchPath;
            }
        } else {
            console.log(`[FaceFusion] Template is on real disk: ${templateSearchPath}`);
            absoluteTargetPath = templateSearchPath;
        }
    }

    // Configuration for FaceFusion
    const config = getAppConfig();
    const condaEnv = config.condaEnv; 
    const condaPath = config.condaPath;
    const facefusionDir = config.facefusionDir;
    
    return new Promise((resolve) => {
        try {
            // 1. Save source image
            const base64Data = sourceBase64.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(sourcePath, Buffer.from(base64Data, 'base64'));

            // 2. Build command
            // Note: We use --headless-run for FF 3.3.0
            const pythonCmd = "python facefusion.py";
            const ffParams = `headless-run --execution-providers cuda --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --face-detector-model retinaface --face-detector-score 0.1 --face-landmarker-score 0.1 --face-selector-mode one --source-paths "${sourcePath}" --target-path "${absoluteTargetPath}" --output-path "${outputPath}"`;
            
            let command = `${pythonCmd} ${ffParams}`;
            if (condaEnv) {
                // If the user provided an absolute path to conda.bat, use it
                command = `"${condaPath}" run -n ${condaEnv} ${pythonCmd} ${ffParams}`;
            }

            const activeCwd = facefusionDir || process.cwd();
            console.log(`[FaceFusion] EXEC: ${command}`);
            console.log(`[FaceFusion] CWD: ${activeCwd}`);

            // Use facefusionDir as CWD if provided, and use shell: true for Windows
            const execOptions = { 
                cwd: facefusionDir || undefined,
                shell: true 
            };

            exec(command, execOptions, (error, stdout, stderr) => {
                // Cleanup helper
                const cleanup = () => {
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                            if (tempTargetPath && fs.existsSync(tempTargetPath)) {
                                fs.unlinkSync(tempTargetPath);
                                console.log('[FaceFusion] Cleaned up temp target');
                            }
                        } catch (e) {}
                    }, 5000);
                };

                if (error) {
                    console.error('[FaceFusion] Execution error:', error);
                    console.error('[FaceFusion] stderr:', stderr);
                    cleanup();
                    resolve({ success: false, error: error.message });
                    return;
                }

                console.log('[FaceFusion] Command completed');
                
                // 3. Read output file and convert to base64
                if (fs.existsSync(outputPath)) {
                    const outputBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });
                    const dataUrl = `data:image/png;base64,${outputBase64}`;
                    
                    cleanup();
                    resolve({ success: true, image: dataUrl });
                } else {
                    cleanup();
                    resolve({ success: false, error: 'Output file not generated' });
                }
            });
        } catch (err) {
            console.error('[FaceFusion] Exception:', err);
            resolve({ success: false, error: err.message });
        }
    });
});

// Handle Print Requests - DNP Professional Native Print
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

            // 2. Platform-specific Print Command
            let printCommand;

            if (process.platform === 'win32') {
                // Windows: Use Shell Image Print engine
                printCommand = `rundll32.exe C:\\WINDOWS\\system32\\shimgvw.dll,ImageView_PrintTo /pt "${tempImagePath}" "${printerName}"`;
            } else if (process.platform === 'darwin') {
                // macOS: Use lp command
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
                    }, 10000);

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
