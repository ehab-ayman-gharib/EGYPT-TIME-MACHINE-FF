# Cloudinary Differential Sync Workflow

This workflow describes how to implement a non-blocking background synchronization between a Cloudinary "Featured" tag and a local Electron assets folder. This allows the photobooth to mirror a cloud-managed gallery with zero manual file management on the local machine.

## 1. Cloudinary Setup
Ensure your Cloudinary project is configured to allow fetching resource lists by tag:
- **Source of Truth**: `https://res.cloudinary.com/<cloud_name>/image/list/<tag>.json`
- **Security**: Note that this endpoint requires the "Resource List" capability to be enabled in your Cloudinary Security settings (Settings > Security > Restricted Media Types > Resource List).

## 2. Electron Main Process (`main.cjs`)
Implement the IPC handlers to manage the local filesystem. This logic uses **Differential Sync** and **Path Sanitization** to ensure folders in Cloudinary don't break the local filesystem.

```javascript
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// 1. Get current local state
ipcMain.handle('get-featured-info', async () => {
    const featuredPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'Featured') 
        : path.join(__dirname, '../Featured');

    if (!fs.existsSync(featuredPath)) fs.mkdirSync(featuredPath, { recursive: true });

    const files = fs.readdirSync(featuredPath)
        .filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i))
        .map(f => path.join(featuredPath, f));

    return { count: files.length, files };
});

// 2. Perform Differential Sync
ipcMain.handle('sync-featured-images', async (event, imageData) => {
    const featuredPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'Featured') 
        : path.join(__dirname, '../Featured');

    if (!fs.existsSync(featuredPath)) fs.mkdirSync(featuredPath, { recursive: true });

    try {
        const localFiles = fs.readdirSync(featuredPath);
        
        // CRITICAL: Sanitize remote IDs by flattening slashes to underscores
        const remoteIds = imageData.map(img => {
            const sanitizedId = img.id.replace(/\//g, '_');
            return `${sanitizedId}${path.extname(img.url)}`;
        });

        // STEP A: Delete local files not in remote list
        for (const file of localFiles) {
            if (!remoteIds.includes(file)) {
                fs.unlinkSync(path.join(featuredPath, file));
            }
        }

        // STEP B: Download missing files
        for (const img of imageData) {
            const ext = path.extname(img.url);
            // Sanitize ID for local filename
            const sanitizedId = img.id.replace(/\//g, '_');
            const fileName = `${sanitizedId}${ext}`;
            const filePath = path.join(featuredPath, fileName);

            if (!fs.existsSync(filePath)) {
                const response = await axios({ url: img.url, method: 'GET', responseType: 'stream' });
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            }
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

## 3. React Implementation (`App.tsx`)
Trigger the sync on app start. Use **Folder Filtering** to ensure you only sync images belonging to the current project.

```tsx
const CLOUDINARY_CLOUD_NAME = "your_cloud_name";
const PROJECT_FOLDER = "Your-Project-Name"; // Cloudinary folder name

useEffect(() => {
    const syncFeaturedImages = async () => {
        try {
            const response = await fetch(`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/Featured.json`);

            if (response.status === 404) {
                await ipcRenderer.invoke('sync-featured-images', []);
                return;
            }

            if (!response.ok) return;

            const data = await response.json();
            const allResources = data.resources || [];

            // FILTER: Only sync images that belong to this project's folder
            const projectImages = allResources.filter((img: any) => 
                img.public_id.startsWith(`${PROJECT_FOLDER}/`)
            );

            const imageData = projectImages.map((img: any) => ({
                id: img.public_id,
                url: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v${img.version}/${img.public_id}.${img.format}`
            }));

            await ipcRenderer.invoke('sync-featured-images', imageData);
        } catch (err) {
            console.warn('[Sync] Failed:', err);
        }
    };

    syncFeaturedImages();
}, []);
```

## 4. Troubleshooting: ENOENT Errors
If you see errors like `ENOENT: no such file or directory, open '...Featured/some-folder/image.jpg'`, it means Cloudinary's `public_id` contains a folder path. 
- **Solution**: The `replace(/\//g, '_')` logic in the Electron code "flattens" these paths so `folder/image.jpg` becomes `folder_image.jpg` locally, avoiding the need to create subdirectories.

## 5. Summary of Benefits
- **Multi-Project Support**: Use one Cloudinary account for many events by filtering by folder.
- **Zero Manual Management**: Tag an image "Featured" in the cloud, and it appears on all booths automatically.
- **Offline Resilient**: Images are cached locally; the app works without internet after the initial sync.
