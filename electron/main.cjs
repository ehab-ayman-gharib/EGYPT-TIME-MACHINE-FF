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
        fullscreen: true,
        autoHideMenuBar: true,
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

        const unpackedBase = path.join(resourcesPath, 'app.asar.unpacked');
        const asarBase = path.join(resourcesPath, 'app.asar');
        
        const possiblePaths = app.isPackaged ? [
            path.join(unpackedBase, 'dist', targetPath),
            path.join(asarBase, 'dist', targetPath),
        ] : [
            path.join(__dirname, '../public', targetPath)
        ];

        foundPath = possiblePaths.find(p => fs.existsSync(p));
        if (!foundPath) foundPath = path.join(__dirname, '../public', targetPath);
    }

    const config = getAppConfig();
    let activeCwd = config.facefusionDir;
    
    if (!activeCwd) {
        if (app.isPackaged) {
            activeCwd = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'facefusion');
        } else {
            activeCwd = path.join(__dirname, '../public/facefusion');
        }
    }
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const execProvider = isMac ? 'coreml' : 'cuda';
    
    // Determine Python Binary & Environment Paths
    const envBase = config.condaEnv && config.condaPath
        ? path.join(path.dirname(config.condaPath), '..', 'envs', config.condaEnv)
        : null;

    const scriptPath = path.join(activeCwd, 'facefusion.py');
    const pythonExecutable = envBase 
        ? path.join(envBase, isWin ? 'python.exe' : 'bin/python')
        : path.join(activeCwd, 'venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

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
                let templateAttempts = 0;
                const maxTemplateAttempts = 3;
                let finalFoundPath = "";

                while (templateAttempts < maxTemplateAttempts) {
                    templateAttempts++;
                    let currentTryPath = foundPath;

                    // 1. Random Image Selection (within current folder if foundPath is a dir)
                    if (fs.existsSync(foundPath) && fs.statSync(foundPath).isDirectory()) {
                        const allFiles = fs.readdirSync(foundPath);
                        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
                        const validImages = allFiles.filter(file => imageExtensions.includes(path.extname(file).toLowerCase()));

                        if (validImages.length > 0) {
                            const randomImage = validImages[Math.floor(Math.random() * validImages.length)];
                            currentTryPath = path.join(foundPath, randomImage);
                        } else {
                            throw new Error(`No valid images found in folder: ${foundPath}`);
                        }
                    }

                    console.log(`🎲 [FaceFusion] Template Attempt ${templateAttempts}/${maxTemplateAttempts}: ${path.basename(currentTryPath)}`);

                    // 2. ASAR Protection & Normalization
                    let absoluteTryPath = currentTryPath;
                    if (currentTryPath.includes('.asar') && !currentTryPath.includes('.asar.unpacked')) {
                        const finalExt = path.extname(currentTryPath) || '.jpg';
                        const tempTarg = path.join(tempDir, `ff_target_try_${timestamp}_${templateAttempts}${finalExt}`);
                        fs.writeFileSync(tempTarg, fs.readFileSync(currentTryPath));
                        absoluteTryPath = tempTarg;
                    }

                    // 3. Handshake: Analyze Slots
                    const isDev = !app.isPackaged;
                    const publicPath = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../dist').replace(/\\/g, '/')}`;
                    const relativeTemplatePath = absoluteTryPath.split('public')[1] || absoluteTryPath.split('dist')[1] || absoluteTryPath;
                    const templateUrl = absoluteTryPath.startsWith('http') ? absoluteTryPath : `${publicPath}${relativeTemplatePath.replace(/\\/g, '/')}`;
                    
                    let targetSlots = [];
                    try {
                        targetSlots = await mainWindow.webContents.executeJavaScript(`window.analyzeTemplate("${templateUrl}")`);
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
