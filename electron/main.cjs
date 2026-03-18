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
        fullscreen: true, // Set to true for fullscreen mode
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

            if (typeof platformConfig === 'object' && platformConfig !== null) {
                // New nested structure
                printerName = platformConfig.printerName || "";
                condaEnv = platformConfig.condaEnv || "";
                condaPath = platformConfig.condaPath || "conda";
                facefusionDir = platformConfig.facefusionDir || "";
            } else {
                // Backwards compatibility with legacy flat structure
                printerName = parsedConfig[platform] || parsedConfig.printerName || "";
                condaEnv = parsedConfig.condaEnv || "";
                condaPath = parsedConfig.condaPath || "conda";
                facefusionDir = parsedConfig.facefusionDir || "";
            }

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

    const pythonExecutableRaw = pythonExecutable; 
    const pythonCmd = pythonExecutable === "python" ? `python facefusion.py` : `"${pythonExecutable}" facefusion.py`;

    // FaceFusion expects 'yolo_face' not 'yoloface'
    // Lowered scores to absolute valid minimums (0.15 / 0.0) to force detection on difficult target templates
    const commonParams = `--execution-providers ${execProvider} --face-detector-model yolo_face --face-detector-score 0.15 --face-landmarker-score 0.0 --face-selector-mode one --reference-face-distance 1.0`;

    return new Promise(async (resolve) => {
        try {
            // 1. Save source image
            const base64Data = sourceBase64.replace(/^data:image\/\w+;base64,/, '');
            let sourceBuffer = Buffer.from(base64Data, 'base64');
            const timestamp = Date.now();
            const sourcePath = path.join(tempDir, `ff_source_${timestamp}.png`);
            
            // PRE-FLIGHT RESCALING: Ensure stability for 4K+ images by normalizing to 2000px
            let imgMetadata = await sharp(sourceBuffer).metadata();
            let activeFaces = faces;

            if (imgMetadata.width > 2048 || imgMetadata.height > 2048) {
                const limit = 2048;
                const scale = imgMetadata.width > imgMetadata.height ? limit / imgMetadata.width : limit / imgMetadata.height;
                console.log(`[FaceFusion] 📏 4K+ Image Normalization: Rescaling from ${imgMetadata.width}px to ${limit}px for stability.`);
                
                sourceBuffer = await sharp(sourceBuffer).resize(limit, limit, { fit: 'inside' }).toBuffer();
                imgMetadata = await sharp(sourceBuffer).metadata(); // Refresh metadata after resize
                
                if (faces) {
                    activeFaces = faces.map(f => ({
                        x: f.x * scale,
                        y: f.y * scale,
                        width: f.width * scale,
                        height: f.height * scale
                    }));
                }
            }

            fs.writeFileSync(sourcePath, sourceBuffer);

            // Check if we should use Orchestrator Logic (2-Pass Sequential Anchor)
            const isDualSwap = activeFaces && activeFaces.length === 2 && 
                               (targetPath.includes('1M_1F') || 
                                targetPath.includes('1F_1M') || 
                                targetPath.includes('2M') || 
                                targetPath.includes('2F'));

            const env = { ...process.env };
            
            if (isWin) {
                // 1. Inherit standard environment
                Object.assign(env, process.env);
                
                // 2. Fix critical Windows variables
                env.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
                env.SystemDrive = process.env.SystemDrive || 'C:';
                env.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';

                // 3. NUCLEAR DELETE of PATH/Path to let Conda manage its own
                delete env.PATH;
                delete env.Path;
                delete env.path;
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

            console.log(`[FaceFusion] Running in CWD: ${facefusionDir || process.cwd()}`);
            console.log(`[FaceFusion] System PATH for execution: ${env.PATH || env.Path}`);

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
                const extractCrop = async (targetIndex, allFaces, outPath) => {
                    const targetFace = allFaces[targetIndex];
                    // 2.2x padding ensures YOLO always has enough context for wide shots
                    const padding = 2.2; 
                    const imgW = Math.floor(imgMetadata.width);
                    const imgH = Math.floor(imgMetadata.height);
                    
                    const centerX = targetFace.x + targetFace.width / 2;
                    const centerY = targetFace.y + targetFace.height / 2;
                    
                    // 1. Calculate size
                    const size = Math.floor(Math.max(targetFace.width, targetFace.height) * padding);
                    
                    // 2. Calculate coordinates
                    let left = Math.floor(centerX - size / 2);
                    let top = Math.floor(centerY - size / 2);
                    
                    // 3. Stricter Clamping
                    left = Math.max(0, Math.min(left, imgW - size));
                    top = Math.max(0, Math.min(top, imgH - size));
                    
                    const extractWidth = Math.max(1, Math.floor(Math.min(size, imgW - left)));
                    const extractHeight = Math.max(1, Math.floor(Math.min(size, imgH - top)));

                    console.log(`[FaceFusion] 🧊 Extracting Crop [Target #${targetIndex}]: ${extractWidth}x${extractHeight} at [${left}, ${top}]`);

                    // 4. Extract base image crop buffer
                    const baseBuffer = await sharp(sourceBuffer)
                        .extract({ left, top, width: extractWidth, height: extractHeight })
                        .toBuffer();

                    // 5. Build Blur Masks for neighbor faces
                    // We use Heavy Gaussian Blur instead of solid blocks.
                    // This is much safer for AI enhancers (GFPGAN) and prevents "Black Square" artifacts.
                    const composites = [];
                    for (let i = 0; i < allFaces.length; i++) {
                        if (i === targetIndex) continue; // Skip target
                        
                        const face = allFaces[i];
                        const blockPadding = 1.3; // Surgical tightness to protect the target's face
                        const blockW = Math.floor(face.width * blockPadding);
                        const blockH = Math.floor(face.height * blockPadding);
                        
                        // DIRECTIONAL OFFSET: Push the blur mask 8% away from the target face center
                        // This protects the target's jaw/ears while aggressively blurring the neighbor.
                        const offsetX = face.x > targetFace.x ? (face.width * 0.08) : -(face.width * 0.08);
                        const blockX = Math.floor(face.x - (blockW - face.width) / 2 + offsetX);
                        const blockY = Math.floor(face.y - (blockH - face.height) / 2);

                        const rX = blockX - left;
                        const rY = blockY - top;

                        const interX = Math.max(0, rX);
                        const interY = Math.max(0, rY);
                        const interW = Math.min(rX + blockW, extractWidth) - interX;
                        const interH = Math.min(rY + blockH, extractHeight) - interY;

                        if (interW > 5 && interH > 5) {
                            try {
                                const blurredNeighbor = await sharp(baseBuffer)
                                    .extract({ left: interX, top: interY, width: interW, height: interH })
                                    .blur(20) // Heavy sigma 20 to completely break facial landmarks
                                    .toBuffer();
                                    
                                composites.push({
                                    input: blurredNeighbor,
                                    left: interX,
                                    top: interY
                                });
                            } catch (e) {
                                console.warn(`[FaceFusion] Blur overlay failed for index ${i}:`, e.message);
                            }
                        }
                    }

                    let proc = sharp(baseBuffer);
                    if (composites.length > 0) {
                        proc = proc.composite(composites);
                    }
                    
                    const maskedBuffer = await proc.toBuffer();

                    // 6. Resize cleanly
                    await sharp(maskedBuffer)
                        .resize({
                            width: 512,
                            height: 512,
                            fit: 'contain',
                            background: { r: 0, g: 0, b: 0, alpha: 1 }
                        })
                        .jpeg({ quality: 95 })
                        .toFile(outPath);
                };

                await extractCrop(0, activeFaces, cropLeftPath);
                await extractCrop(1, activeFaces, cropRightPath);

                // Step 3: Sequential Execution
                // Pass 1: The Left Anchor
                const normalizedCondaPath = isWin ? condaPath.replace(/\//g, '\\') : condaPath;
                const cmd1Params = `headless-run ${commonParams} --processors face_swapper --face-swapper-model inswapper_128_fp16 --face-selector-order left-right --reference-face-position 0 --source-paths "${cropLeftPath}" --target-path "${absoluteTargetPath}" --output-path "${intermediatePath}"`;
                const cmd1 = condaEnv ? `"${normalizedCondaPath}" run -n ${condaEnv} ${pythonCmd} ${cmd1Params}` : `${pythonCmd} ${cmd1Params}`;
                
                console.log(`[FaceFusion] >>> Pass 1 START (Left Anchor)`);
                console.log(`[FaceFusion] EXEC: ${cmd1}`);
                
                const pass1Result = await new Promise((res) => {
                    let stderrAccumulator = "";
                    const proc = exec(cmd1, execOptions, (err) => {
                        if (err) {
                            console.error(`[FaceFusion] Pass 1 Failed with Error:`, err.message);
                            res({ success: false, error: err.message, stderr: stderrAccumulator });
                        } else {
                            res({ success: true });
                        }
                    });
                    proc.stdout.on('data', d => process.stdout.write(`[FF-P1] ${d}`));
                    proc.stderr.on('data', d => {
                        const text = d.toString();
                        process.stderr.write(`[FF-P1-ERR] ${text}`);
                        stderrAccumulator += text;
                    });
                });

                if (!pass1Result.success) {
                    throw new Error(`Pass 1 Failed: ${pass1Result.stderr || pass1Result.error}`);
                }
                console.log(`[FaceFusion] <<< Pass 1 COMPLETE`);

                // Pass 2: The Right Anchor (With Enhancer)
                const cmd2Params = `headless-run ${commonParams} --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --face-selector-order right-left --reference-face-position 0 --source-paths "${cropRightPath}" --target-path "${intermediatePath}" --output-path "${outputPath}"`;
                const cmd2 = condaEnv ? `"${normalizedCondaPath}" run -n ${condaEnv} ${pythonCmd} ${cmd2Params}` : `${pythonCmd} ${cmd2Params}`;
                
                console.log(`[FaceFusion] >>> Pass 2 START (Right Anchor + Enhancer)`);
                console.log(`[FaceFusion] EXEC: ${cmd2}`);

                const pass2Result = await new Promise((res) => {
                    let stderrAccumulator = "";
                    const proc = exec(cmd2, execOptions, (err) => {
                        if (err) {
                            console.error(`[FaceFusion] Pass 2 Failed with Error:`, err.message);
                            res({ success: false, error: err.message, stderr: stderrAccumulator });
                        } else {
                            res({ success: true });
                        }
                    });
                    proc.stdout.on('data', d => process.stdout.write(`[FF-P2] ${d}`));
                    proc.stderr.on('data', d => {
                        const text = d.toString();
                        process.stderr.write(`[FF-P2-ERR] ${text}`);
                        stderrAccumulator += text;
                    });
                });

                if (!pass2Result.success) {
                    throw new Error(`Pass 2 Failed: ${pass2Result.stderr || pass2Result.error}`);
                }
                console.log(`[FaceFusion] <<< Pass 2 COMPLETE`);

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
                
                console.log(`[FaceFusion] >>> START Single Pass Transformation`);
                console.log(`[FaceFusion] EXEC: ${command}`);

                const singlePassResult = await new Promise((res) => {
                    let stderrAccumulator = "";
                    const proc = exec(command, execOptions, (err) => {
                        if (err) {
                            console.error(`[FaceFusion] Single Pass Failed with Error:`, err.message);
                            res({ success: false, error: err.message, stderr: stderrAccumulator });
                        } else {
                            res({ success: true });
                        }
                    });
                    proc.stdout.on('data', d => process.stdout.write(`[FF] ${d}`));
                    proc.stderr.on('data', d => {
                        const text = d.toString();
                        process.stderr.write(`[FF-ERR] ${text}`);
                        stderrAccumulator += text;
                    });
                });

                if (!singlePassResult.success) {
                    throw new Error(`Face Swap Failed: ${singlePassResult.stderr || singlePassResult.error}`);
                }
                console.log(`[FaceFusion] <<< COMPLETE Single Pass Transformation`);
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
