import { EraData, EraId } from '../types';

export const applyEraStamp = (imageSrc: string, era: EraData): Promise<string> => {
    return new Promise((resolve) => {
        const hasFrame = era.frames && era.frames.length > 0;

        let assetsLoaded = 0;
        const totalAssets = 2 + (hasFrame ? 1 : 0); // Main Image + Background + Frame (if exists)

        const onAssetLoad = () => {
            assetsLoaded++;
            if (assetsLoaded === totalAssets) {
                processComposition();
            }
        };

        const createSafeImage = (src: string, isEssential = false) => {
            const img = new Image();
            if (!src.startsWith('data:')) {
                img.crossOrigin = "anonymous";
            }
            img.onload = onAssetLoad;
            img.onerror = (err) => {
                console.error(`[Composition] Failed to load image: ${src}`, err);
                if (isEssential) {
                    resolve(imageSrc);
                } else {
                    onAssetLoad();
                }
            };
            img.src = src;
            return img;
        };

        const mainImage = createSafeImage(imageSrc, true);

        // Background selection based on era
        const backgroundPath = era.id === EraId.OLD_EGYPT
            ? './Backgrounds/Old-Egyptian/Old-Egyptian-Background.jpg'
            : './Backgrounds/Generic-Background.jpg';
        const backgroundImg = createSafeImage(backgroundPath, true);

        // Frame selection (top layer)
        const frameImg = hasFrame ? createSafeImage(era.frames[0]) : null;

        const processComposition = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(imageSrc);
                return;
            }

            // Canvas size for 4x6 inch printing at 300 DPI: 1800 x 2700 pixels
            canvas.width = 1800;
            canvas.height = 2700;

            // 1. Draw Background - BASE layer
            ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);

            // 2. Calculate the Frame position and size (centered on canvas)
            const scaleFactor = canvas.width / 1266;
            const targetFrameWidth = Math.round(1171 * scaleFactor);  // ~1679px
            const targetFrameHeight = Math.round(1772 * scaleFactor); // ~2520px
            const frameX = (canvas.width - targetFrameWidth) / 2;
            const frameY = (canvas.height - targetFrameHeight) / 2;

            // 3. Draw Main Image - MIDDLE layer
            // Photo sits just inside the frame's inner border, centered both ways.
            // We define an "inset area" inside the frame, then FIT the image into it (no cropping).
            const insetWidth = Math.round(targetFrameWidth * 0.88);
            const insetHeight = Math.round(targetFrameHeight * 0.88);
            //
            const insetX = frameX + (targetFrameWidth - insetWidth) / 1.25;
            const insetY = frameY + (targetFrameHeight - insetHeight) / 1.85;

            // Contain: Scale the full image to fit inside the inset area without cropping
            const imgAspect = mainImage.width / mainImage.height;
            const insetAspect = insetWidth / insetHeight;

            let drawWidth, drawHeight;
            if (imgAspect > insetAspect) {
                // Image is wider than inset: fit by width
                drawWidth = insetWidth;
                drawHeight = insetWidth / imgAspect;
            } else {
                // Image is taller than inset: fit by height
                drawHeight = insetHeight;
                drawWidth = insetHeight * imgAspect;
            }

            // Center the fitted image within the inset area
            const imageX = insetX + (insetWidth - drawWidth) / 2;
            const imageY = insetY + (insetHeight - drawHeight) / 2;

            ctx.drawImage(mainImage, 0, 0, mainImage.width, mainImage.height, imageX, imageY, drawWidth, drawHeight);

            // 4. Draw Frame - TOP layer (acts as the decorative border overlay)
            if (hasFrame && frameImg) {
                ctx.drawImage(frameImg, frameX, frameY, targetFrameWidth, targetFrameHeight);
            }

            // Stamping/Branding logic remains commented out per user request
            /*
            const logoImage = createSafeImage(['./Logos/Gold-Logo.png', './Logos/Original-Logo.png'][Math.floor(Math.random() * 2)]);
            const logoInternalPadding = targetWidth * 0.05;
            const logoScale = 0.385; 
            const logoWidth = targetWidth * logoScale;
            const logoHeight = logoWidth * (logoImage.height / logoImage.width);
            const logoX = targetX + logoInternalPadding;
            const logoY = targetY + logoInternalPadding;
            ctx.drawImage(logoImage, logoX, logoY, logoWidth, logoHeight);
            */

            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
    });
};
