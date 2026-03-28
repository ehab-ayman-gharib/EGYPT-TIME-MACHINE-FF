/**
 * ELECTRON MAIN PROCESS - EGYPT TIME MACHINE
 * -----------------------------------------
 * This is the entry point for the Electron application. 
 * It manages the native window, handles system-level integrations (FileSystem, Printers, External Commands),
 * and facilitates communication between the React frontend and the backend services (FaceFusion, Printing).
 */

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let mainWindow = null;

/**
 * 1. WINDOW INITIALIZATION
 * Creates the main application window and configures permissions for camera access.
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,     // Allows using 'require' in frontend (essential for some legacy libs)
            contextIsolation: false,    // Disables isolation for easier communication (non-standard but used here)
            autoplayPolicy: 'no-user-gesture-required', // Essential for auto-playing attraction videos
            devTools: true,
        },
        fullscreen: false,              // DISABLED for testing/debugging
        autoHideMenuBar: false,
    });

    // Permission Handlers: Ensure the app can access the camera and other hardware without popups
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

    // Load appropriate URL/File based on environment
    if (isDevEnv) {
        mainWindow.loadURL('http://localhost:3000'); // Vite dev server
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html')); // Production build
    }

    // Force Open DevTools even in production for test verification
    mainWindow.webContents.openDevTools();

    // Post-load setup: Printer discovery and Shortcuts
    mainWindow.webContents.on('did-finish-load', async () => {
        console.log('[Startup] Application loaded');
        
        // Add a global shortcut for DevTools in production for easier debugging/tuning
        mainWindow.on('focus', () => {
            globalShortcut.register('CommandOrControl+Shift+I', () => {
                mainWindow.webContents.toggleDevTools();
            });
        });

        // Detect available printers on startup
        try {
            const printers = await mainWindow.webContents.getPrintersAsync();
            console.log('[Startup] Available printers:', printers.length);
            printers.forEach((printer, index) => {
                console.log(`[Startup] Printer ${index + 1}:`, {
                    name: printer.name,
                    status: printer.status
                });
            });
        } catch (err) {
            console.error('[Startup] Failed to get printers:', err);
        }
    });
}

/**
 * 2. CONFIGURATION MANAGEMENT
 * Reads 'booth-config.json' from the resources or root directory.
 * This file contains environment paths, printer names, and Conda configurations.
 */
function getAppConfig() {
    const configPath = app.isPackaged
        ? path.join(process.resourcesPath, 'booth-config.json')
        : path.join(__dirname, '../booth-config.json');

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

            if (typeof platformConfig === 'object' && platformConfig !== null) {
                // Nested structure (modern)
                printerName = platformConfig.printerName || "";
                condaEnv = platformConfig.condaEnv || "";
                condaPath = platformConfig.condaPath || "conda";
                facefusionDir = platformConfig.facefusionDir || "";
            } else {
                // Flat structure (legacy)
                printerName = parsedConfig[platform] || parsedConfig.printerName || "";
                condaEnv = parsedConfig.condaEnv || "";
                condaPath = parsedConfig.condaPath || "conda";
                facefusionDir = parsedConfig.facefusionDir || "";
            }

            console.log(`[Config] Loaded - Printer: ${printerName}, Conda: ${condaEnv}`);
            return { printerName, condaEnv, condaPath, facefusionDir };
        }
    } catch (err) {
        console.warn('[Config] Failed to read config:', err.message);
    }

    return { printerName: "", condaEnv: "", condaPath: "conda", facefusionDir: "" };
}

/**
 * 3. PRINTER HELPER
 * Attempts to intelligently match a configured printer name with available system printers.
 */
function findBestPrinter(configuredName, availablePrinters) {
    if (!configuredName) return "";
    const nameMatch = availablePrinters.find(p => p.name === configuredName || p.name.toLowerCase().includes(configuredName.toLowerCase()));
    return nameMatch ? nameMatch.name : configuredName;
}

/**
 * 4. IPC HANDLERS (Bridging React to System)
 */

// A. Get list of printers for the Result Screen
ipcMain.handle('get-printers', async () => {
    try {
        const win = BrowserWindow.getAllWindows()[0];
        const { printers, config } = { printers: await win.webContents.getPrintersAsync(), config: getAppConfig() };
        return { printers, config };
    } catch (error) {
        console.error('[Electron] Error getting printers:', error);
        return { printers: [], config: { printerName: "" } };
    }
});

// B. EXECUTE FACEFUSION (The core AI transformation)
// This handler orchestrates the call to the local python-based FaceFusion instance.
ipcMain.handle('execute-face-fusion', async (event, { sourceBase64, targetPath, faces }) => {
    console.log('🚀 [FaceFusion] Workflow Started | Target Area:', targetPath);
    const os = require('os');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const sourcePath = path.join(tempDir, `ff_source_${timestamp}.png`);
    
    const targetExt = path.extname(targetPath) || '.jpg';
    const outputPath = path.join(tempDir, `ff_output_${timestamp}${targetExt}`);
    
    // File Path Normalization
    targetPath = path.normalize(targetPath.replace(/\\/g, '/'));

    // Resolve Target Image (Handle ASAR unpacking if necessary)
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
        ] : [
            path.join(__dirname, '../public', targetPath)
        ];

        let foundPath = possiblePaths.find(p => fs.existsSync(p));
        if (!foundPath) foundPath = path.join(__dirname, '../public', targetPath);

        /**
         * TARGET RANDOMIZATION
         * --------------------
         * If the found path is a directory (e.g., 'templates/Modern/1M'), 
         * we list all image files and pick one at random. This prevents
         * a predictable/monotonous experience for users.
         */
        if (foundPath && fs.existsSync(foundPath) && fs.statSync(foundPath).isDirectory()) {
            const allFiles = fs.readdirSync(foundPath);
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
            const validImages = allFiles.filter(file => imageExtensions.includes(path.extname(file).toLowerCase()));

            if (validImages.length > 0) {
                const randomImage = validImages[Math.floor(Math.random() * validImages.length)];
                foundPath = path.join(foundPath, randomImage);
                console.log(`🎲 [FaceFusion] Randomized Target Seed: ${randomImage}`);
            } else {
                console.warn(`[FaceFusion] Warning: No valid images found in folder: ${foundPath}`);
            }
        }

        // ASAR Protection: Extract if inside compressed ASAR
        // FaceFusion (the python process) cannot read files directly from inside the .asar archive.
        if (foundPath && foundPath.includes('.asar') && !foundPath.includes('.asar.unpacked')) {
            const finalExt = path.extname(foundPath) || '.jpg';
            tempTargetPath = path.join(tempDir, `ff_target_${timestamp}${finalExt}`);
            fs.writeFileSync(tempTargetPath, fs.readFileSync(foundPath));
            absoluteTargetPath = tempTargetPath;
        } else {
            absoluteTargetPath = foundPath;
        }
    }

    const config = getAppConfig();
    const activeCwd = config.facefusionDir || process.cwd();
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const execProvider = isMac ? 'coreml' : 'cuda';
    
    // Determine Python Binary
    let pythonExecutable = isMac 
        ? path.join(activeCwd, 'venv', 'bin', 'python')
        : (config.condaEnv ? "python" : path.join(activeCwd, 'venv', 'Scripts', 'python.exe'));

    const pythonCmd = pythonExecutable === "python" ? `python facefusion.py` : `"${pythonExecutable}" facefusion.py`;
    
    // FaceFusion Tuning Parameters
    // Using YOLO_FACE and extreme score tolerance for historical portrait compatibility
    const commonParams = `--execution-providers ${execProvider} --face-detector-model yolo_face --face-detector-score 0.15 --face-landmarker-score 0.0 --face-selector-mode one --reference-face-distance 1.0`;

    return new Promise(async (resolve) => {
        try {
            // Step 1: Prepare Source Image
            const base64Data = sourceBase64.replace(/^data:image\/\w+;base64,/, '');
            let sourceBuffer = Buffer.from(base64Data, 'base64');
            const imgMetadata = await sharp(sourceBuffer).metadata();
            
            // PRE-FLIGHT RESCALING: Limit source image to 2048px for processing stability
            if (imgMetadata.width > 2048 || imgMetadata.height > 2048) {
                sourceBuffer = await sharp(sourceBuffer).resize(2048, 2048, { fit: 'inside' }).toBuffer();
            }
            fs.writeFileSync(sourcePath, sourceBuffer);

            // Step 2: Determine Strategy (Dual Swap for groups vs Single Swap)
            const isDualSwap = faces && faces.length === 2 && targetPath.match(/1M_1F|1F_1M|2M|2F/);
            const env = { ...process.env };
            
            // Environment Sanitization for Windows/Mac
            if (isWin) {
                delete env.PATH; delete env.Path; // Let Conda resolve paths
            }

            const execOptions = { 
                cwd: activeCwd, 
                shell: isWin ? (env.ComSpec || true) : true, 
                env: env, 
                maxBuffer: 1024 * 1024 * 100 
            };

            /**
             * ORCHESTRATOR LOGIC: 2-Pass Sequential Anchor
             * Used for 2-person shots to ensure the AI swaps both faces correctly without confusion.
             * 1. Extract Crop 1 (Left Person) -> Blur Neighbor -> Run FF
             * 2. Extract Crop 2 (Right Person) -> Blur Neighbor -> Run FF on Pass 1 output
             */
            if (isDualSwap) {
                console.log('[FaceFusion] Starting 2-Pass Orchestration...');
                const cropLeftPath = path.join(tempDir, `crop_left_${timestamp}.jpg`);
                const cropRightPath = path.join(tempDir, `crop_right_${timestamp}.jpg`);
                const intermediatePath = path.join(tempDir, `intermediate_${timestamp}${targetExt}`);

                // Helper to create masked crops
                const extractCrop = async (targetIndex, outPath) => {
                    const targetFace = faces[targetIndex];
                    const size = Math.floor(Math.max(targetFace.width, targetFace.height) * 2.2);
                    const left = Math.max(0, Math.floor(targetFace.x + targetFace.width/2 - size/2));
                    const top = Math.max(0, Math.floor(targetFace.y + targetFace.height/2 - size/2));
                    
                    await sharp(sourceBuffer)
                        .extract({ left, top, width: Math.min(size, imgMetadata.width - left), height: Math.min(size, imgMetadata.height - top) })
                        .resize(512, 512, { fit: 'contain' })
                        .toFile(outPath);
                };

                await extractCrop(0, cropLeftPath);
                await extractCrop(1, cropRightPath);

                // Pass 1: Left Actor
                const cmd1Params = `headless-run ${commonParams} --processors face_swapper --face-swapper-model inswapper_128_fp16 --face-selector-order left-right --reference-face-position 0 --source-paths "${cropLeftPath}" --target-path "${absoluteTargetPath}" --output-path "${intermediatePath}"`;
                const cmd1 = config.condaEnv ? `"${config.condaPath}" run -n ${config.condaEnv} ${pythonCmd} ${cmd1Params}` : `${pythonCmd} ${cmd1Params}`;
                await execAsync(cmd1, execOptions);

                // Pass 2: Right Actor + Enhancer
                const cmd2Params = `headless-run ${commonParams} --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --face-selector-order right-left --reference-face-position 0 --source-paths "${cropRightPath}" --target-path "${intermediatePath}" --output-path "${outputPath}"`;
                const cmd2 = config.condaEnv ? `"${config.condaPath}" run -n ${config.condaEnv} ${pythonCmd} ${cmd2Params}` : `${pythonCmd} ${cmd2Params}`;
                await execAsync(cmd2, execOptions);

            } else {
                // Single Pass (Standard Logic)
                const ffParams = `headless-run ${commonParams} --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --source-paths "${sourcePath}" --target-path "${absoluteTargetPath}" --output-path "${outputPath}"`;
                const command = config.condaEnv ? `"${config.condaPath}" run -n ${config.condaEnv} ${pythonCmd} ${ffParams}` : `${pythonCmd} ${ffParams}`;
                console.log('⚙️ [FaceFusion] Executing AI Command:', command);
                await execAsync(command, execOptions);
                console.log('✅ [FaceFusion] Execution finished successfully');
            }

            // Step 3: Result Retrieval
            if (fs.existsSync(outputPath)) {
                const outputBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });
                resolve({ success: true, image: `data:image/jpeg;base64,${outputBase64}` });
            } else {
                resolve({ success: false, error: 'Output file failed to generate.' });
            }

        } catch (err) {
            console.error('[FaceFusion] Error:', err);
            resolve({ success: false, error: err.message });
        } finally {
            // Cleanup temp files after a reasonable buffer
            setTimeout(() => {
                [sourcePath, outputPath, tempTargetPath].forEach(p => p && fs.existsSync(p) && fs.unlinkSync(p));
            }, 30000);
        }
    });
});

// C. PRINTING SERVICE
// Uses native system calls (lp on Mac, rundll32 on Windows) for professional borderless printing.
ipcMain.handle('print-image', async (event, { imageSrc, printerName }) => {
    return new Promise(async (resolve) => {
        const tempImagePath = path.join(require('os').tmpdir(), `print-${Date.now()}.png`);
        try {
            const base64Data = imageSrc.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(tempImagePath, Buffer.from(base64Data, 'base64'));

            const printCommand = process.platform === 'win32'
                ? `rundll32.exe C:\\WINDOWS\\system32\\shimgvw.dll,ImageView_PrintTo /pt "${tempImagePath}" "${printerName}"`
                : `lp -d "${printerName}" -o fit-to-page "${tempImagePath}"`;

            require('child_process').exec(printCommand, { shell: true }, (error) => {
                setTimeout(() => fs.existsSync(tempImagePath) && fs.unlinkSync(tempImagePath), 10000);
                resolve({ success: !error, failureReason: error ? error.message : null });
            });
        } catch (err) {
            resolve({ success: false, failureReason: err.message });
        }
    });
});

/**
 * 5. APP LIFECYCLE
 */
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
