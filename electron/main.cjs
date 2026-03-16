const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

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

            const platform = process.platform;
            const platformConfig = parsedConfig[platform];
            
            let printerName = "";
            let condaEnv = "";
            let condaPath = "conda";
            let facefusionDir = "";
            let ffmpegPath = "";

            if (typeof platformConfig === 'object' && platformConfig !== null) {
                // New nested structure
                printerName = platformConfig.printerName || "";
                condaEnv = platformConfig.condaEnv || "";
                condaPath = platformConfig.condaPath || "conda";
                facefusionDir = platformConfig.facefusionDir || "";
                ffmpegPath = platformConfig.ffmpegPath || "";
            } else {
                // Backwards compatibility with legacy flat structure
                printerName = parsedConfig[platform] || parsedConfig.printerName || "";
                condaEnv = parsedConfig.condaEnv || "";
                condaPath = parsedConfig.condaPath || "conda";
                facefusionDir = parsedConfig.facefusionDir || "";
            }

            console.log(`[Config] Loaded - Printer: ${printerName}, Conda: ${condaEnv}, FF Dir: ${facefusionDir}`);
            return { printerName, condaEnv, condaPath, facefusionDir, ffmpegPath };
        }
    } catch (err) {
        console.warn('[Config] Failed to read config:', err.message);
    }

    return { printerName: "", condaEnv: "", condaPath: "conda", facefusionDir: "", ffmpegPath: "" };
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
ipcMain.handle('execute-face-fusion', async (event, { sourceBase64, targetPath, faces }) => {
    console.log('[FaceFusion] Execution requested', { targetPath, faceCount: faces ? faces.length : 0 });
    const os = require('os');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const sourcePath = path.join(tempDir, `ff_source_${timestamp}.png`);
    
    // Determine target extension to match it for output (FaceFusion requirement)
    const targetExt = path.extname(targetPath) || '.jpg';
    const outputPath = path.join(tempDir, `ff_output_${timestamp}${targetExt}`);
    
    // File Path Normalization
    targetPath = path.normalize(targetPath.replace(/\\/g, '/'));

    // Ensure target path is absolute
    let absoluteTargetPath = targetPath;
    let tempTargetPath = null;

    if (!path.isAbsolute(targetPath)) {
        let resourcesPath = process.resourcesPath;
        if (process.platform === 'darwin' && app.isPackaged) {
            resourcesPath = path.join(path.dirname(process.execPath), '..', 'Resources');
        }

        const unpackedBase = path.join(resourcesPath, 'app.asar.unpacked');
        const asarBase = path.join(resourcesPath, 'app.asar');
        
        const possiblePaths = app.isPackaged ? [
            path.join(unpackedBase, 'dist', targetPath),
            path.join(asarBase, 'dist', targetPath),
            path.join(resourcesPath, 'app', 'dist', targetPath)
        ] : [
            path.join(__dirname, '../public', targetPath)
        ];

        let foundPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (!foundPath && app.isPackaged) {
            foundPath = path.join(asarBase, 'dist', targetPath);
        } else if (!foundPath) {
            foundPath = path.join(__dirname, '../public', targetPath);
        }

        if (foundPath.includes('.asar') && !foundPath.includes('.asar.unpacked')) {
            console.log('[FaceFusion] Extracting target from ASAR...');
            tempTargetPath = path.join(tempDir, `ff_target_${timestamp}${targetExt}`);
            try {
                const buffer = fs.readFileSync(foundPath);
                fs.writeFileSync(tempTargetPath, buffer);
                absoluteTargetPath = tempTargetPath;
            } catch (e) {
                absoluteTargetPath = foundPath;
            }
        } else {
            absoluteTargetPath = foundPath;

            if (fs.existsSync(absoluteTargetPath) && fs.statSync(absoluteTargetPath).isDirectory()) {
                try {
                    const files = fs.readdirSync(absoluteTargetPath).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
                    if (files.length > 0) {
                        const randomFile = files[Math.floor(Math.random() * files.length)];
                        absoluteTargetPath = path.join(absoluteTargetPath, randomFile);
                    }
                } catch (dirErr) { }
            }
        }
    }

    // Configuration for FaceFusion
    const config = getAppConfig();
    const condaEnv = config.condaEnv; 
    const condaPath = path.normalize(config.condaPath);
    const facefusionDir = config.facefusionDir;
    const ffmpegPath = config.ffmpegPath;
    const activeCwd = facefusionDir || process.cwd();
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const execProvider = isMac ? 'coreml' : 'cuda';
    
    // Command parts
    // Cross-Platform Python Binary Selection
    let pythonExecutable = "python";
    if (isMac) {
        // Mac: Always prefer local venv as requested
        pythonExecutable = path.join(activeCwd, 'venv', 'bin', 'python');
        console.log(`[FaceFusion] Mac - Using Venv: ${pythonExecutable}`);
    } else if (isWin) {
        if (condaEnv) {
            // Windows + Conda: Use simple 'python' for conda run to resolve
            pythonExecutable = "python";
            console.log(`[FaceFusion] Win - Using Conda Env: ${condaEnv}`);
        } else {
            // Windows - Fallback to venv if no conda env
            pythonExecutable = path.join(activeCwd, 'venv', 'Scripts', 'python.exe');
            console.log(`[FaceFusion] Win - Using fallback Venv: ${pythonExecutable}`);
        }
    }

    const pythonCmd = `"${pythonExecutable}" facefusion.py`;

    const commonParams = `--execution-providers ${execProvider} --face-detector-model retinaface --face-detector-score 0.1 --face-landmarker-score 0.1 --face-selector-mode one`;

    return new Promise(async (resolve) => {
        try {
            // 1. Save source image
            const base64Data = sourceBase64.replace(/^data:image\/\w+;base64,/, '');
            const sourceBuffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(sourcePath, sourceBuffer);

            // Check if we should use Orchestrator Logic (2-Pass Sequential Anchor)
            const isDualSwap = faces && faces.length === 2 && 
                               (targetPath.includes('1M_1F') || 
                                targetPath.includes('1F_1M') || 
                                targetPath.includes('2M') || 
                                targetPath.includes('2F'));

            const env = { ...process.env };
            
            if (isWin) {
                // Critical: Ensure critical Windows variables are present
                env.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
                env.SystemDrive = process.env.SystemDrive || 'C:';
                env.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
                env.TEMP = process.env.TEMP || os.tmpdir();
                env.TMP = process.env.TMP || os.tmpdir();

                // Merge Path robustly
                const extraWinPaths = [
                    'C:\\Windows\\System32',
                    'C:\\Windows',
                    'C:\\Windows\\System32\\Wbem',
                    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\',
                    'C:\\Windows\\System32\\OpenSSH\\',
                    condaPath ? path.dirname(condaPath) : '',
                    ffmpegPath ? path.dirname(ffmpegPath) : ''
                ].filter(p => p);
                
                const currentPath = process.env.PATH || process.env.Path || '';
                const allPaths = [...new Set([
                    ...extraWinPaths,
                    ...currentPath.split(';')
                ])].filter(p => p).join(';');
                
                env.PATH = allPaths;
                env.Path = allPaths;
            }

            if (isMac) {
                // Packaged Mac apps lose the user's terminal PATH.
                const extraPaths = ['/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/bin', '/opt/homebrew/bin'];
                const currentPath = env.PATH || '';
                env.PATH = extraPaths.filter(p => !currentPath.includes(p)).join(':') + (currentPath ? `:${currentPath}` : '');
            }

            const execOptions = { 
                cwd: facefusionDir || undefined,
                shell: isWin ? (env.ComSpec || true) : true,
                env: env,
                maxBuffer: 1024 * 1024 * 100
            };

            const cleanup = () => {
                setTimeout(() => {
                    try {
                        if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        if (tempTargetPath && fs.existsSync(tempTargetPath)) fs.unlinkSync(tempTargetPath);
                    } catch (e) {}
                }, 15000);
            };

            if (isDualSwap) {
                console.log('[FaceFusion] 🛠️ Orchestrator Logic: 2-Pass Sequential Anchor');
                
                const cropLeftPath = path.join(tempDir, `crop_left_${timestamp}.jpg`);
                const cropRightPath = path.join(tempDir, `crop_right_${timestamp}.jpg`);
                const intermediatePath = path.join(tempDir, `intermediate_${timestamp}${targetExt}`);

                // Step 2: Physical Isolation (The "Crops")
                const imgMetadata = await sharp(sourceBuffer).metadata();
                const extractCrop = async (box, outPath) => {
                    const padding = 1.6; // Slightly more than 1.5 as requested, for safety
                    const w = box.width * padding;
                    const h = box.height * padding;
                    const l = Math.max(0, box.x - (w - box.width) / 2);
                    const t = Math.max(0, box.y - (h - box.height) / 2);

                    await sharp(sourceBuffer)
                        .extract({
                            left: Math.round(Math.min(l, imgMetadata.width - 1)),
                            top: Math.round(Math.min(t, imgMetadata.height - 1)),
                            width: Math.round(Math.min(w, imgMetadata.width - l)),
                            height: Math.round(Math.min(h, imgMetadata.height - t))
                        })
                        .toFile(outPath);
                };

                await extractCrop(faces[0], cropLeftPath);
                await extractCrop(faces[1], cropRightPath);

                // Step 3: Sequential Execution
                // Pass 1: The Left Anchor
                const normalizedCondaPath = isWin ? condaPath.replace(/\//g, '\\') : condaPath;
                const cmd1Params = `headless-run ${commonParams} --processors face_swapper --face-swapper-model inswapper_128_fp16 --face-selector-order left-right --reference-face-position 0 --source-paths "${cropLeftPath}" --target-path "${absoluteTargetPath}" --output-path "${intermediatePath}"`;
                const cmd1 = condaEnv ? `"${normalizedCondaPath}" run -n ${condaEnv} ${pythonCmd} ${cmd1Params}` : `${pythonCmd} ${cmd1Params}`;
                
                console.log(`[FaceFusion] Pass 1 (Left): ${cmd1}`);
                await execAsync(cmd1, execOptions);

                // Pass 2: The Right Anchor (With Enhancer)
                const cmd2Params = `headless-run ${commonParams} --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --face-selector-order right-left --reference-face-position 0 --source-paths "${cropRightPath}" --target-path "${intermediatePath}" --output-path "${outputPath}"`;
                const cmd2 = condaEnv ? `"${normalizedCondaPath}" run -n ${condaEnv} ${pythonCmd} ${cmd2Params}` : `${pythonCmd} ${cmd2Params}`;
                
                console.log(`[FaceFusion] Pass 2 (Right): ${cmd2}`);
                await execAsync(cmd2, execOptions);

                // Cleanup crops
                setTimeout(() => {
                    try {
                        if (fs.existsSync(cropLeftPath)) fs.unlinkSync(cropLeftPath);
                        if (fs.existsSync(cropRightPath)) fs.unlinkSync(cropRightPath);
                        if (fs.existsSync(intermediatePath)) fs.unlinkSync(intermediatePath);
                    } catch(e) {}
                }, 10000);

            } else {
                // Standard Single Pass Logic
                const normalizedCondaPath = isWin ? condaPath.replace(/\//g, '\\') : condaPath;
                const ffParams = `headless-run ${commonParams} --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --source-paths "${sourcePath}" --target-path "${absoluteTargetPath}" --output-path "${outputPath}"`;
                const command = condaEnv ? `"${normalizedCondaPath}" run -n ${condaEnv} ${pythonCmd} ${ffParams}` : `${pythonCmd} ${ffParams}`;
                
                console.log(`[FaceFusion] EXEC: ${command}`);
                await execAsync(command, execOptions);
            }

            // Read result
            if (fs.existsSync(outputPath)) {
                const outputBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });
                const mimeType = targetExt.toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
                cleanup();
                resolve({ success: true, image: `data:${mimeType};base64,${outputBase64}` });
            } else {
                cleanup();
                resolve({ success: false, error: 'Output file not generated' });
            }

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

            exec(printCommand, { shell: true }, (error, stdout, stderr) => {
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
