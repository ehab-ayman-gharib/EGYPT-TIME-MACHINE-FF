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
const https = require('https');

// Load environment variables from .env.local manually since dotenv is not a dependency
const envPath = app.isPackaged 
    ? path.join(process.resourcesPath, '.env.local')
    : path.join(__dirname, '..', '.env.local');

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
    console.log('[Env] Loaded .env.local from:', envPath);
} else {
    console.warn('[Env] .env.local not found at:', envPath);
}

let mainWindow = null;
let isKioskModeActive = true;
let isRecreatingWindow = false;

/**
 * STATE MANAGEMENT FOR TEMPLATE ROTATION
 * Tracks the last used template index per era to maintain rotation state across era switches.
 */
let eraTemplateIndices = {};


/**
 * 1. WINDOW INITIALIZATION
 * Creates the main application window and configures permissions for camera access.
 */
function createWindow(isKiosk = true) {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        fullscreen: isKiosk,
        kiosk: isKiosk, // This locks the app down natively on macOS
        alwaysOnTop: isKiosk, // Keeps it above any random system alerts
        movable: !isKiosk,
        resizable: !isKiosk,
        frame: !isKiosk, // Enables title bars, close, and minimize buttons when windowed
        autoHideMenuBar: isKiosk,
        webPreferences: {
            nodeIntegration: true,     // Allows using 'require' in frontend (essential for some legacy libs)
            contextIsolation: false,    // Disables isolation for easier communication (non-standard but used here)
            autoplayPolicy: 'no-user-gesture-required', // Essential for auto-playing attraction videos
            devTools: true,
            webSecurity: false,         // Required to load local images via file:// protocol
        },
    });

    // Prevent user from navigating away via touch/gestures
    mainWindow.on('always-on-top-changed', () => {
        if (isKioskModeActive) {
            mainWindow.setAlwaysOnTop(true);
        }
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

    // Open DevTools only in development mode
    if (isDevEnv) {
        mainWindow.webContents.openDevTools();
    }

    // Post-load setup: Printer discovery and Shortcuts
    mainWindow.webContents.on('did-finish-load', async () => {
        console.log('[Startup] Application loaded');
        
        // Add a global shortcut for DevTools in production for easier debugging/tuning
        mainWindow.on('focus', () => {
            globalShortcut.register('CommandOrControl+Shift+I', () => {
                mainWindow.webContents.toggleDevTools();
            });
        });

        mainWindow.on('blur', () => {
            globalShortcut.unregister('CommandOrControl+Shift+I');
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
 * 3. CONDA DETECTION HELPER
 * Automatically locates the Conda installation directory on Windows.
 */
function detectCondaPath(configuredPath) {
    const fs = require('fs');
    const { execSync } = require('child_process');

    // 1. Check if configured path exists
    if (configuredPath && fs.existsSync(configuredPath)) return configuredPath;

    // 2. Try common installation paths
    const commonPaths = [
        path.join(process.env.USERPROFILE, 'miniconda3', 'condabin', 'conda.bat'),
        path.join(process.env.USERPROFILE, 'anaconda3', 'condabin', 'conda.bat'),
        'C:\\ProgramData\\miniconda3\\condabin\\conda.bat',
        'C:\\ProgramData\\anaconda3\\condabin\\conda.bat',
        'D:\\miniconda3\\condabin\\conda.bat',
        'E:\\miniconda3\\condabin\\conda.bat'
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            console.log(`[Conda] Auto-detected at: ${p}`);
            return p;
        }
    }

    // 3. Try 'where' command
    try {
        const whereResult = execSync('where conda', { encoding: 'utf-8' }).split('\n')[0].trim();
        if (whereResult && fs.existsSync(whereResult)) {
            // Ensure we point to condabin/conda.bat if possible for better activation
            const binDir = path.dirname(whereResult);
            const batPath = path.join(binDir, 'conda.bat');
            const condaBinPath = path.join(path.dirname(binDir), 'condabin', 'conda.bat');
            
            if (fs.existsSync(condaBinPath)) return condaBinPath;
            if (fs.existsSync(batPath)) return batPath;
            return whereResult;
        }
    } catch (e) {
        // 'where' failed, conda might not be in PATH
    }

    return "conda"; // Fallback to global command
}

/**
 * 4. PRINTER HELPER
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
ipcMain.handle('execute-face-fusion', async (event, { sourceBase64, targetPath, faces, isGroup }) => {
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
    let foundPath = targetPath;

    if (!path.isAbsolute(targetPath)) {
        let resourcesPath = process.resourcesPath;
        if (process.platform === 'darwin' && app.isPackaged) {
            resourcesPath = path.join(path.dirname(process.execPath), '..', 'Resources');
        }

        const possiblePaths = [
            path.join(TEMPLATES_DIR, targetPath)
        ];

        foundPath = possiblePaths.find(p => fs.existsSync(p));
        if (!foundPath) foundPath = path.join(TEMPLATES_DIR, targetPath);
    }

    const config = getAppConfig();
    let activeCwd = config.facefusionDir;
    
    if (!activeCwd) {
        if (app.isPackaged) {
            activeCwd = path.join(process.resourcesPath, 'facefusion');
        } else {
            activeCwd = path.join(__dirname, '../facefusion');
        }
    }
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    
    // Platform-specific execution providers (CoreML for Mac Silicon, CUDA for Windows NVIDIA)
    const execProvider = isMac ? 'coreml' : 'cuda';
    
    // Auto-detect Conda Path if on Windows
    const effectiveCondaPath = isWin ? detectCondaPath(config.condaPath) : config.condaPath;

    /**
     * 5. PYTHON ENVIRONMENT ORCHESTRATION
     * Windows: Uses Conda environment (typically 'facefusion')
     * Mac: Uses local venv (typically in './public/facefusion/venv')
     */
    let envBase = null;
    if (isWin && config.condaEnv && effectiveCondaPath && path.isAbsolute(effectiveCondaPath)) {
        // Resolve Conda Environment Path (assuming standard layout)
        envBase = path.join(path.dirname(effectiveCondaPath), '..', 'envs', config.condaEnv);
    }

    const scriptPath = path.join(activeCwd, 'facefusion.py');
    const pythonExecutable = envBase 
        ? path.join(envBase, 'python.exe') // Windows Conda Path
        : path.join(activeCwd, 'venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python'); // Local venv Fallback

    const pythonCmd = `"${pythonExecutable}" "${scriptPath}"`;
    
    // FaceFusion Tuning Parameters
    const commonParams = `--execution-providers ${execProvider} --face-detector-model yolo_face --face-detector-score 0.15 --face-landmarker-score 0.0 --face-selector-mode one --reference-face-distance 1.0`;

    // env for exec
    const env = { ...process.env };
    
    // Fix for macOS packaged apps where process.env.PATH might be missing or minimal
    if (isMac) {
        const macPath = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
        env.PATH = env.PATH ? `${env.PATH}:${macPath}` : macPath;
    }

    if (isWin && envBase) {
        const condaPaths = [
            envBase,
            path.join(envBase, 'Scripts'),
            path.join(envBase, 'Library', 'bin'),
            path.join(envBase, 'Library', 'usr', 'bin'),
            path.join(envBase, 'Library', 'mingw-w64', 'bin')
        ];
        const pathSeparator = ';';
        const pathKey = 'Path';
        env[pathKey] = [...condaPaths, process.env[pathKey] || ''].join(pathSeparator);
    }

    const execOptions = { 
        cwd: activeCwd, 
        shell: isWin ? (env.ComSpec || true) : true, 
        env: env, 
        maxBuffer: 1024 * 1024 * 100 
    };

    return new Promise(async (resolve) => {
        try {
            // Step 1: Prepare Source Image
            const base64Data = sourceBase64.replace(/^data:image\/\w+;base64,/, '');
            let sourceBuffer = Buffer.from(base64Data, 'base64');
            sourceBuffer = await sharp(sourceBuffer).rotate().toBuffer();
            const imgMetadata = await sharp(sourceBuffer).metadata();
            
            if (imgMetadata.width > 2048 || imgMetadata.height > 2048) {
                sourceBuffer = await sharp(sourceBuffer).resize(2048, 2048, { fit: 'inside' }).toBuffer();
            }
            fs.writeFileSync(sourcePath, sourceBuffer);
            await new Promise(r => setTimeout(r, 500));

            if (faces && faces.length >= 1) {
                /**
                 * TEMPLATE SELECTION & MAPPING LOOP
                 * ---------------------------------
                 * We attempt to find a compatible template by trying up to 3 random files
                 * from the target folder. A compatible template is one where the detected
                 * face slots match the genders of our source users.
                 */
                let templateBuffer = null;
                let templateMetadata = null;
                let mappedFaces = [];
                let finalFoundPath = "";

                // 1. Initialize era index tracking
                if (typeof eraTemplateIndices[foundPath] === 'undefined') {
                    console.log(`🔄 [FaceFusion] First time in era ${foundPath}. Initializing rotation.`);
                    eraTemplateIndices[foundPath] = -1;
                }

                let validImages = [];
                if (fs.existsSync(foundPath) && fs.statSync(foundPath).isDirectory()) {
                    const allFiles = fs.readdirSync(foundPath);
                    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
                    validImages = allFiles
                        .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
                        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })); // Sort alphabetically/numerically
                }

                /**
                 * TEMPLATE SELECTION LOOP
                 * -----------------------
                 * We cycle through the valid images in the folder starting from the next index.
                 * We stop at the first compatible template (matching gender slots).
                 */
                const maxTemplateAttempts = Math.min(validImages.length, 5); // Try up to 5 sequentially
                let templateAttempts = 0;

                while (templateAttempts < maxTemplateAttempts) {
                    templateAttempts++;
                    
                    // Increment and Wrap Index per era
                    eraTemplateIndices[foundPath] = (eraTemplateIndices[foundPath] + 1) % validImages.length;
                    let currentTemplateIndex = eraTemplateIndices[foundPath];
                    const selectedImage = validImages[currentTemplateIndex];
                    let currentTryPath = path.join(foundPath, selectedImage);

                    console.log(`⚙️ [FaceFusion] Rotation Step ${templateAttempts}: Using template index ${currentTemplateIndex} (${selectedImage})`);


                    // 2. ASAR Protection & Normalization
                    let absoluteTryPath = currentTryPath;
                    if (currentTryPath.includes('.asar') && !currentTryPath.includes('.asar.unpacked')) {
                        const finalExt = path.extname(currentTryPath) || '.jpg';
                        const tempTarg = path.join(tempDir, `ff_target_try_${timestamp}_${templateAttempts}${finalExt}`);
                        fs.writeFileSync(tempTarg, fs.readFileSync(currentTryPath));
                        absoluteTryPath = tempTarg;
                    }

                    // 3. Handshake: Analyze Slots via Data URL (Bulletproof for Electron)
                    let targetSlots = [];
                    try {
                        const templateBuffer = fs.readFileSync(absoluteTryPath);
                        const templateDataUrl = `data:image/jpeg;base64,${templateBuffer.toString('base64')}`;
                        targetSlots = await mainWindow.webContents.executeJavaScript(`window.analyzeTemplate("${templateDataUrl}")`);
                    } catch (err) {
                        console.warn(`[Handshake] Analysis failed for ${templateUrl}:`, err.message);
                        continue;
                    }

                    if (!targetSlots || targetSlots.length < faces.length) {
                        console.warn(`[Mapping] Template ${path.basename(currentTryPath)} has insufficient slots (${targetSlots?.length || 0} vs required ${faces.length}). Skipping...`);
                        continue;
                    }

                    // 4. Gender-Aware Identity Mapping
                    const currentMappedFaces = [];
                    let availableUserFaces = [...faces];
                    let mismatchFound = false;

                    for (let i = 0; i < targetSlots.length; i++) {
                        const slot = targetSlots[i];
                        let matchIndex = availableUserFaces.findIndex(f => f.gender === slot.gender);
                        
                        if (matchIndex === -1 && availableUserFaces.length > 0) {
                            console.warn(`[Mapping] GENDER MISMATCH in ${path.basename(currentTryPath)}: Slot ${i+1} (${slot.gender}) has no user match.`);
                            mismatchFound = true;
                            break; 
                        }

                        if (matchIndex !== -1) {
                            const matchedUser = availableUserFaces.splice(matchIndex, 1)[0];
                            currentMappedFaces.push({ user: matchedUser, slot: slot });
                        }
                    }

                    if (!mismatchFound && currentMappedFaces.length >= faces.length) {
                        mappedFaces = currentMappedFaces;
                        finalFoundPath = absoluteTryPath;
                        templateBuffer = fs.readFileSync(absoluteTryPath);
                        templateMetadata = await sharp(templateBuffer).metadata();
                        console.log(`✅ [FaceFusion] Found compatible template: ${path.basename(absoluteTryPath)}`);
                        break;
                    }
                }

                if (!finalFoundPath || mappedFaces.length === 0) {
                    console.error('🛑 [FaceFusion] GENDER_MISMATCH: Failed to find a compatible template after multiple attempts.');
                    throw new Error("GENDER_MISMATCH");
                }

                // STEP 5: Surgical Isolation & Transformation
                const processedTiles = [];
                const localMetadata = await sharp(sourceBuffer).metadata();
                const scaleX = localMetadata.width / imgMetadata.width;
                const scaleY = localMetadata.height / imgMetadata.height;

                for (let i = 0; i < mappedFaces.length; i++) {
                    const { user: sourceFace, slot } = mappedFaces[i];
                    const sourceBox = sourceFace.box;

                    console.log(`👤 [FaceFusion] Transformation Pass ${i + 1}/${mappedFaces.length} | User Gender: ${sourceFace.gender} | Slot Gender: ${slot.gender}`);

                    // Pad the source crop (add context like forehead/hair) to help AI detection.
                    const pad = 0.25; 
                    const sw = sourceBox.width * scaleX;
                    const sh = sourceBox.height * scaleY;
                    const sl = sourceBox.x * scaleX;
                    const st = sourceBox.y * scaleY;

                    const srcExtractWidth = Math.min(Math.floor(sw * (1 + pad * 2)), localMetadata.width);
                    const srcExtractHeight = Math.min(Math.floor(sh * (1 + pad * 2)), localMetadata.height);
                    const srcExtractLeft = Math.max(0, Math.floor(sl - sw * pad));
                    const srcExtractTop = Math.max(0, Math.floor(st - sh * pad));

                    // FaceFusion Command wants a Source Image (we use the extracted head tile)
                    const sourceFacePath = path.join(tempDir, `ff_src_face_${timestamp}_${i}.png`);
                    
                    await sharp(sourceBuffer)
                        .extract({ 
                            left: srcExtractLeft, 
                            top: srcExtractTop, 
                            width: Math.min(srcExtractWidth, localMetadata.width - srcExtractLeft), 
                            height: Math.min(srcExtractHeight, localMetadata.height - srcExtractTop) 
                        })
                        .resize(512, 512, { fit: 'inside' })
                        .toFile(sourceFacePath);

                    // SURGICAL CROP (Target Tile) with Padding
                    const padding = 0.25; // 25% padding
                    const extractWidth = Math.floor(slot.width * (1 + padding * 2));
                    const extractHeight = Math.floor(slot.height * (1 + padding * 2));
                    const extractLeft = Math.max(0, Math.floor(slot.x - slot.width * padding));
                    const extractTop = Math.max(0, Math.floor(slot.y - slot.height * padding));

                    const tileInputPath = path.join(tempDir, `ff_tile_in_${timestamp}_${i}.jpg`);
                    const tileOutputPath = path.join(tempDir, `ff_tile_out_${timestamp}_${i}.jpg`);

                    await sharp(templateBuffer)
                        .extract({ 
                            left: extractLeft, 
                            top: extractTop, 
                            width: Math.min(extractWidth, templateMetadata.width - extractLeft), 
                            height: Math.min(extractHeight, templateMetadata.height - extractTop) 
                        })
                        .toFile(tileInputPath);

                    // Isolated AI Execution (with Auto-Retry)
                    const ffParams = `headless-run ${commonParams} --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --source-paths "${sourceFacePath}" --target-path "${tileInputPath}" --output-path "${tileOutputPath}"`;
                    const command = `${pythonCmd} ${ffParams}`;
                    
                    console.log(`⚙️ [FaceFusion] Pass ${i+1}/${mappedFaces.length} Tile Swap...`);
                    
                    let attempt = 0;
                    const maxAttempts = 2;
                    let success = false;

                    while (attempt < maxAttempts && !success) {
                        try {
                            await execAsync(command, execOptions);
                            success = true;
                        } catch (err) {
                            attempt++;
                            console.warn(`⚠️ [FaceFusion] Pass ${i+1}, Attempt ${attempt} failed. ${attempt < maxAttempts ? 'Retrying...' : 'Aborting.'}`);
                            if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500));
                            else throw err;
                        }
                    }

                    processedTiles.push({
                        input: tileOutputPath,
                        left: extractLeft,
                        top: extractTop
                    });

                    if (fs.existsSync(sourceFacePath)) fs.unlinkSync(sourceFacePath);
                }

                // Final Assembly
                console.log(`🧩 [Assembly] Compositing ${mappedFaces.length} face(s) back to high-res template...`);
                await sharp(templateBuffer)
                    .composite(processedTiles)
                    .toFile(outputPath);

            } else {
                throw new Error("No faces provided for processing.");
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
                const filesToCleanup = [sourcePath, outputPath, tempTargetPath];
                // Add any face tiles if they exist
                if (faces && faces.length >= 1) {
                    for (let i = 0; i < faces.length; i++) {
                        filesToCleanup.push(path.join(tempDir, `ff_tile_in_${timestamp}_${i}.jpg`));
                        filesToCleanup.push(path.join(tempDir, `ff_tile_out_${timestamp}_${i}.jpg`));
                        filesToCleanup.push(path.join(tempDir, `ff_src_face_${timestamp}_${i}.png`));
                    }
                }
                filesToCleanup.forEach(p => {
                    if (p && fs.existsSync(p)) {
                        try { fs.unlinkSync(p); } catch (e) {}
                    }
                });
            }, 35000);
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

            let printCommand = '';
            if (process.platform === 'win32') {
                printCommand = `rundll32.exe C:\\WINDOWS\\system32\\shimgvw.dll,ImageView_PrintTo /pt "${tempImagePath}" "${printerName}"`;
            } else {
                let options = '-o fit-to-page';
                const lowerName = (printerName || '').toLowerCase();
                if (lowerName.includes('qw410') || lowerName.includes('dnp') || lowerName.includes('photobooth')) {
                    options += ' -o PageSize=dnp4x6';
                }
                printCommand = `lp -d "${printerName}" ${options} "${tempImagePath}"`;
            }

            require('child_process').exec(printCommand, { shell: true }, (error) => {
                setTimeout(() => fs.existsSync(tempImagePath) && fs.unlinkSync(tempImagePath), 10000);
                resolve({ success: !error, failureReason: error ? error.message : null });
            });
        } catch (err) {
            resolve({ success: false, failureReason: err.message });
        }
    });
});

// C2. CLEAR PRINTER QUEUE
// Cancels all print jobs for a specific printer (PowerShell on Windows, CUPS cancel on Mac)
ipcMain.handle('clear-printer-queue', async (event, { printerName }) => {
    return new Promise((resolve) => {
        if (!printerName) {
            console.log('[Printer] No printer name provided to clear queue.');
            return resolve({ success: false, error: 'No printer name provided' });
        }
        
        let clearCommand = '';
        if (process.platform === 'win32') {
            // Using PowerShell to query jobs for this printer and remove them
            clearCommand = `powershell -Command "Get-PrintJob -PrinterName '${printerName}' | Remove-PrintJob"`;
        } else {
            // CUPS cancel command for macOS
            clearCommand = `cancel -a "${printerName}"`;
        }

        console.log(`[Printer] Attempting to clear queue for: ${printerName} using command: ${clearCommand}`);

        require('child_process').exec(clearCommand, { shell: true }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Printer] Failed to clear queue for ${printerName}:`, error.message);
                resolve({ success: false, error: error.message });
            } else {
                console.log(`[Printer] Successfully cleared queue for ${printerName}`);
                resolve({ success: true });
            }
        });
    });
});

// D. FEATURED ASSETS SERVICE
const FEATURED_DIR = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'Featured');
const VIDEO_CACHE_DIR = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'VideoCache');
const TEMPLATES_DIR = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'templates');

// Ensure folder exists on startup
if (!fs.existsSync(FEATURED_DIR)) {
    try {
        fs.mkdirSync(FEATURED_DIR, { recursive: true });
        console.log('[Featured] Created directory:', FEATURED_DIR);
    } catch (err) {
        console.error('[Featured] Failed to create directory:', err);
    }
}

// Ensure Video Cache folder exists
if (!fs.existsSync(VIDEO_CACHE_DIR)) {
    try {
        fs.mkdirSync(VIDEO_CACHE_DIR, { recursive: true });
        console.log('[VideoCache] Created directory:', VIDEO_CACHE_DIR);
    } catch (err) {
        console.error('[VideoCache] Failed to create directory:', err);
    }
}

ipcMain.handle('get-featured-info', async () => {
    try {
        if (!fs.existsSync(FEATURED_DIR)) return { count: 0, files: [] };
        const files = fs.readdirSync(FEATURED_DIR).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
        return { 
            count: files.length, 
            files: files.map(f => path.join(FEATURED_DIR, f)) 
        };
    } catch (err) {
        console.error('[Featured] Error reading info:', err);
        return { count: 0, files: [] };
    }
});

ipcMain.handle('sync-featured-images', async (event, images) => {
    // 'images' is an array of { id: string, url: string }
    console.log(`[Featured] Starting differential sync for ${images.length} images...`);
    
    try {
        const existingFiles = fs.readdirSync(FEATURED_DIR);
        const remoteIds = images.map(img => `${img.id.replace(/[\/\\]/g, '_')}.jpg`);
        
        // 1. Identify orphans (files locally but not on remote)
        const toDelete = existingFiles.filter(file => !remoteIds.includes(file) && file.endsWith('.jpg'));
        
        // 2. Identify missing (remote but not local)
        const toDownload = images.filter(img => {
            const fileName = `${img.id.replace(/[\/\\]/g, '_')}.jpg`;
            return !existingFiles.includes(fileName);
        });

        console.log(`[Featured] Sync Plan: ${toDownload.length} to download, ${toDelete.length} to delete, ${images.length - toDownload.length} already up to date.`);

        if (toDownload.length === 0 && toDelete.length === 0) {
            console.log('[Featured] Everything is already in sync.');
            return { success: true, count: images.length };
        }

        // 3. Perform deletions
        for (const file of toDelete) {
            try {
                fs.unlinkSync(path.join(FEATURED_DIR, file));
            } catch (e) {
                console.warn(`[Featured] Failed to delete orphan ${file}:`, e.message);
            }
        }

        // 4. Perform downloads
        const download = (img) => {
            return new Promise((resolve, reject) => {
                const fileName = `${img.id.replace(/[\/\\]/g, '_')}.jpg`;
                const filePath = path.join(FEATURED_DIR, fileName);
                const file = fs.createWriteStream(filePath);
                
                https.get(img.url, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Status ${response.statusCode}`));
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(filePath);
                    });
                }).on('error', (err) => {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    reject(err);
                });
            });
        };

        const results = await Promise.allSettled(toDownload.map(img => download(img)));
        const successful = results.filter(r => r.status === 'fulfilled');
        
        console.log(`[Featured] Sync complete. ${successful.length} new images downloaded.`);
        return { success: true, count: images.length };

    } catch (err) {
        console.error('[Featured] Differential sync failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-cached-video', async (event, url) => {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const ext = path.extname(new URL(url).pathname) || '.mp4';
    const fileName = `video_${hash}${ext}`;
    const filePath = path.join(VIDEO_CACHE_DIR, fileName);

    if (fs.existsSync(filePath)) {
        console.log(`[VideoCache] Cache hit: ${fileName}`);
        return filePath;
    }

    console.log(`[VideoCache] Cache miss. Downloading: ${url}`);
    
    // Ensure directory exists
    if (!fs.existsSync(VIDEO_CACHE_DIR)) fs.mkdirSync(VIDEO_CACHE_DIR, { recursive: true });

    return new Promise((resolve) => {
        const file = fs.createWriteStream(filePath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                console.error(`[VideoCache] Download failed with status ${response.statusCode}`);
                resolve(url);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`[VideoCache] Download complete: ${fileName}`);
                resolve(filePath);
            });
        }).on('error', (err) => {
            console.error('[VideoCache] Download error:', err);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            resolve(url); // Fallback to streaming
        });
    });
});

// E. TEMPLATE SYNC SERVICE
// Helper to recursively list all files in a directory
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });
    return arrayOfFiles;
}

ipcMain.handle('sync-templates', async (event, templates) => {
    // 'templates' is an array of { id: string, url: string, relativePath: string }
    // relativePath example: 'Old Kingdom/1M/template_0.jpg'
    console.log(`[Templates] Starting differential sync for ${templates.length} templates...`);

    try {
        if (!fs.existsSync(TEMPLATES_DIR)) {
            fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
        }

        const allLocalFiles = getAllFiles(TEMPLATES_DIR);

        console.log(`[Templates] Local path: ${TEMPLATES_DIR}`);
        console.log(`[Templates] Remote files count: ${templates.length}`);

        // Helper: get the "stem" of a file path (path without extension)
        const getStem = (filePath) => {
            const ext = path.extname(filePath);
            return filePath.slice(0, filePath.length - ext.length).toLowerCase();
        };

        // Build a set of remote stems (relative to TEMPLATES_DIR) for fast lookup
        const remoteStems = new Set(
            templates.map(t => getStem(path.normalize(path.join(TEMPLATES_DIR, t.relativePath))))
        );

        // Build a map of local stems -> full paths for orphan detection
        const localStemMap = new Map();
        for (const file of allLocalFiles) {
            if (file.endsWith('Thumbs.db')) continue;
            const stem = getStem(path.normalize(file));
            localStemMap.set(stem, file);
        }

        // 1. Identify orphans: local files whose stem has NO match in remote
        const toDelete = allLocalFiles.filter(file => {
            if (file.endsWith('Thumbs.db')) return false;
            const stem = getStem(path.normalize(file));
            return !remoteStems.has(stem);
        });

        // 2. Identify missing: remote files whose stem has NO match locally
        const toDownload = templates.filter(t => {
            const stem = getStem(path.normalize(path.join(TEMPLATES_DIR, t.relativePath)));
            return !localStemMap.has(stem);
        });

        console.log(`[Templates] Sync Plan: ${toDownload.length} to download, ${toDelete.length} to delete.`);

        // 3. Perform deletions
        for (const file of toDelete) {
            try {
                console.log(`[Templates] Deleting orphan: ${path.relative(TEMPLATES_DIR, file)}`);
                fs.unlinkSync(file);
                // Try to remove parent dir if empty
                let parent = path.dirname(file);
                while (parent !== TEMPLATES_DIR) {
                    if (fs.readdirSync(parent).length === 0) {
                        console.log(`[Templates] Removing empty folder: ${path.relative(TEMPLATES_DIR, parent)}`);
                        fs.rmdirSync(parent);
                        parent = path.dirname(parent);
                    } else {
                        break;
                    }
                }
            } catch (e) {
                console.warn(`[Templates] Failed to delete orphan ${file}:`, e.message);
            }
        }

        // 4. Perform downloads
        const download = (t) => {
            return new Promise((resolve, reject) => {
                const filePath = path.join(TEMPLATES_DIR, t.relativePath);
                const dirPath = path.dirname(filePath);
                
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                console.log(`[Templates] Downloading: ${t.relativePath}`);
                const file = fs.createWriteStream(filePath);
                https.get(t.url, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Status ${response.statusCode}`));
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(filePath);
                    });
                }).on('error', (err) => {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    reject(err);
                });
            });
        };

        // Download in chunks to avoid overwhelming the system
        const CHUNK_SIZE = 5;
        for (let i = 0; i < toDownload.length; i += CHUNK_SIZE) {
            const chunk = toDownload.slice(i, i + CHUNK_SIZE);
            await Promise.allSettled(chunk.map(t => download(t)));
        }

        console.log(`[Templates] Sync complete.`);
        return { success: true };

    } catch (err) {
        console.error('[Templates] Sync failed:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('list-remote-templates', async (event, { folder }) => {
    return new Promise((resolve) => {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            console.error('[Cloudinary] Missing credentials in .env.local');
            return resolve({ success: false, error: 'Cloudinary credentials missing in .env.local' });
        }

        console.log(`[Cloudinary] Searching for templates in folder: ${folder}...`);
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        
        // Search API is more robust than Resources API
        const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`;
        const postData = JSON.stringify({
            expression: `folder:"${folder}/*"`,
            max_results: 500
        });

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        console.error('[Cloudinary] Search API Error:', parsed.error.message);
                        resolve({ success: false, error: parsed.error.message });
                    } else {
                        console.log(`[Cloudinary] Search found ${parsed.resources?.length || 0} resources.`);
                        // Ensure each resource has the full public_id even if Cloudinary sends it short
                        const mappedResources = parsed.resources.map(r => ({
                            ...r,
                            public_id: r.public_id // Search API usually includes the folder in public_id
                        }));
                        if (parsed.resources?.length > 0) {
                            console.log('[Cloudinary] First Resource Data:', JSON.stringify(parsed.resources[0], null, 2));
                        }
                        resolve({ success: true, resources: mappedResources });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'Failed to parse Cloudinary response' });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });

        req.write(postData);
        req.end();
    });
});


/**
 * 5. APP LIFECYCLE
 */
/**
 * Helper to register standard OS escape shortcuts (to block them)
 */
function registerKioskShortcuts() {
    try {
        const q = globalShortcut.register('CommandOrControl+Q', () => { 
            console.log('[Kiosk] Blocked CommandOrControl+Q'); 
        });
        const h = globalShortcut.register('CommandOrControl+H', () => { 
            console.log('[Kiosk] Blocked CommandOrControl+H'); 
        });
        const m = globalShortcut.register('CommandOrControl+M', () => { 
            console.log('[Kiosk] Blocked CommandOrControl+M'); 
        });
        console.log(`[Kiosk] Registered blocking shortcuts: Q=${q}, H=${h}, M=${m}`);
    } catch (e) {
        console.error('[Kiosk] Failed to register blocking shortcuts:', e);
    }
}

/**
 * Helper to unregister standard OS escape shortcuts
 */
function unregisterKioskShortcuts() {
    try {
        globalShortcut.unregister('CommandOrControl+Q');
        globalShortcut.unregister('CommandOrControl+H');
        globalShortcut.unregister('CommandOrControl+M');
        console.log('[Kiosk] Unregistered blocking shortcuts.');
    } catch (e) {
        console.error('[Kiosk] Failed to unregister blocking shortcuts:', e);
    }
}

/**
 * 5. APP LIFECYCLE
 */
function toggleKiosk() {
    if (mainWindow) {
        isKioskModeActive = !isKioskModeActive;
        console.log(`[Kiosk] Toggling Kiosk Mode to: ${isKioskModeActive}`);

        isRecreatingWindow = true; // Prevent app.quit in window-all-closed

        // Save current URL
        const currentURL = mainWindow.webContents.getURL();

        // Unregister devtools shortcut to prevent registration collision
        globalShortcut.unregister('CommandOrControl+Shift+I');

        // Destroy current window immediately
        mainWindow.destroy();

        // Recreate window with correct kiosk/frame state
        createWindow(isKioskModeActive);

        // Load saved URL or fallback to main
        if (currentURL) {
            mainWindow.loadURL(currentURL);
        }

        // Register or unregister standard OS escape shortcuts
        if (isKioskModeActive) {
            registerKioskShortcuts();
        } else {
            unregisterKioskShortcuts();
        }

        isRecreatingWindow = false; // Reset flag
        return { success: true, isKioskModeActive };
    }
    return { success: false };
}

ipcMain.handle('toggle-kiosk', () => {
    return toggleKiosk();
});

ipcMain.handle('get-kiosk-status', () => {
    return isKioskModeActive;
});

app.whenReady().then(() => {
    createWindow();

    // Register blocking shortcuts immediately on startup since window starts focused
    if (isKioskModeActive) {
        registerKioskShortcuts();
    }

    // Commented out keyboard shortcut registration as requested (now triggered via title click pattern)
    /*
    const success = globalShortcut.register('CommandOrControl+Alt+Shift+Q', () => {
        toggleKiosk();
    });
    console.log(`[Kiosk] Secret exit shortcut registration status: ${success}`);
    */
});

// Disable standard menu shortcuts globally when focused so users cannot trigger them
app.on('browser-window-focus', () => {
    if (isKioskModeActive) {
        registerKioskShortcuts();
    }
});

// Unregister them when window loses focus to avoid affecting other applications system-wide
app.on('browser-window-blur', () => {
    if (isKioskModeActive) {
        unregisterKioskShortcuts();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (isRecreatingWindow) return; // Prevent app quitting during window recreation
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(isKioskModeActive);
});
