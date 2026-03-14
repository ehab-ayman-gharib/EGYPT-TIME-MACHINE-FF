import '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import { FaceDetectionResult } from '../types';

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================
const LOCAL_MODEL_URL = './models';
const FALLBACK_MODEL_URL = 'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights';

let modelLoadPromise: Promise<boolean> | null = null;
let backendPromise: Promise<void> | null = null;
let envPatched = false;
let tfFetchPatched = false;

// Patch face-api.js environment with browser implementations
const ensureEnvPatched = () => {
    if (envPatched) return;

    const nativeFetch = window.fetch ? window.fetch.bind(window) : undefined;
    if (!nativeFetch) {
        console.warn('Browser fetch implementation missing; face-api.js may not load models correctly.');
    }

    try {
        faceapi.env.monkeyPatch({
            fetch: nativeFetch,
            Canvas: HTMLCanvasElement,
            Image: HTMLImageElement,
            createCanvasElement: () => document.createElement('canvas'),
            createImageElement: () => document.createElement('img')
        });
        envPatched = true;
        console.log('✅ face-api.js environment patched');
    } catch (error) {
        console.warn('Failed to monkey patch face-api.js environment.', error);
    }
};

// Ensure TensorFlow uses native fetch
const ensureTfFetchPatched = () => {
    if (tfFetchPatched) return;

    const nativeFetch = window.fetch ? window.fetch.bind(window) : undefined;
    if (!nativeFetch) return;

    try {
        const platformFetch = faceapi?.tf?.env().platform?.fetch;
        if (platformFetch !== nativeFetch) {
            faceapi.tf.env().platform.fetch = nativeFetch;
        }
        tfFetchPatched = true;
        console.log('✅ TensorFlow fetch patched');
    } catch (error) {
        console.warn('Failed to override TensorFlow.js fetch implementation.', error);
    }
};

// Initialize TensorFlow backend
const ensureBackendReady = async (): Promise<void> => {
    ensureTfFetchPatched();

    if (!backendPromise) {
        backendPromise = (async () => {
            try {
                await faceapi.tf.setBackend('webgl');
                await faceapi.tf.ready();
                console.log('✅ TensorFlow.js WebGL backend initialized');
            } catch (error) {
                console.warn('WebGL backend init failed, falling back to CPU backend', error);
                await faceapi.tf.setBackend('cpu');
                await faceapi.tf.ready();
                console.log('✅ TensorFlow.js CPU backend initialized');
            }
        })().catch((error) => {
            backendPromise = null;
            throw error;
        });
    }

    return backendPromise;
};

// Helper to check if a URL actually returns JSON (and not the React index.html fallback)
const verifyModelUrl = async (baseUrl: string): Promise<boolean> => {
    try {
        const testUrl = `${baseUrl}/tiny_face_detector_model-weights_manifest.json`;
        const response = await fetch(testUrl, { method: 'HEAD' });
        const contentType = response.headers.get('content-type');

        // If the server returns HTML (common in React apps for 404s), this URL is invalid for models
        if (contentType && contentType.includes('text/html')) {
            console.warn(`Model URL ${baseUrl} returned HTML. Treating as missing.`);
            return false;
        }

        return response.ok;
    } catch (e) {
        return false;
    }
};

export const loadFaceApiModels = async (): Promise<boolean> => {
    if (modelLoadPromise) return modelLoadPromise;

    modelLoadPromise = (async () => {
        // 1. Patch environment first
        ensureEnvPatched();

        // 2. Initialize TensorFlow backend
        await ensureBackendReady();

        const loadFromSource = async (baseUrl: string) => {
            console.log(`Attempting to load models from: ${baseUrl}`);

            // Verify availability first to avoid "silent" failures with HTML responses
            const isAvailable = await verifyModelUrl(baseUrl);
            if (!isAvailable) {
                throw new Error(`Model manifest not found or invalid at ${baseUrl}`);
            }

            // Load the DETECTOR (Mandatory)
            // Use SSD Mobilenet V1 for higher accuracy as requested
            await faceapi.nets.ssdMobilenetv1.loadFromUri(baseUrl);

            // Verify it actually loaded
            // @ts-ignore
            if (!faceapi.nets.ssdMobilenetv1.params) {
                throw new Error("SSD Mobilenet V1 loaded but params are empty");
            }

            // Load AUXILIARY models (Optional)
            try {
                await faceapi.nets.ageGenderNet.loadFromUri(baseUrl);
                console.log('✅ AgeGender model loaded');
            } catch (e) {
                console.warn("AgeGender model failed to load (Optional)");
            }

            try {
                await faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl);
                console.log('✅ FaceLandmark model loaded');
            } catch (e) {
                console.warn("Landmark model failed to load (Optional)");
            }
        };

        try {
            // Try Local First
            await loadFromSource(LOCAL_MODEL_URL);
            console.log("✅ Models loaded from LOCAL source.");
            return true;
        } catch (localError) {
            console.warn(`Local model load failed:`, localError);
            try {
                // Fallback to CDN
                await loadFromSource(FALLBACK_MODEL_URL);
                console.log("✅ Models loaded from CDN.");
                return true;
            } catch (cdnError) {
                console.error("❌ CRITICAL: All model sources failed.", cdnError);
                return false;
            }
        }
    })();

    return modelLoadPromise;
};

export const detectFaces = async (videoElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, isLoaded: boolean): Promise<FaceDetectionResult> => {
    // Default safe fallback
    const fallback: FaceDetectionResult = { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };

    if (!isLoaded) return fallback;

    try {
        // Strict Check: Is the detector actually ready?
        // @ts-ignore
        if (!faceapi.nets.ssdMobilenetv1.isLoaded || !faceapi.nets.ssdMobilenetv1.params) {
            console.warn("SSD Mobilenet V1 not ready during inference request.");
            return fallback;
        }

        // Use SSD Mobilenet V1 Options for high accuracy
        // minConfidence 0.5 filters out low quality "ghost" faces
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

        // Build task chain
        let task: any = faceapi.detectAllFaces(videoElement, options);

        // Conditionally add auxiliary tasks ONLY if their models are loaded
        // @ts-ignore
        const hasLandmarks = !!faceapi.nets.faceLandmark68Net.params;
        // @ts-ignore
        const hasGender = !!faceapi.nets.ageGenderNet.params;

        if (hasLandmarks) {
            task = task.withFaceLandmarks();

            // FaceAPI requires landmarks for age/gender detection to align the face
            if (hasGender) {
                task = task.withAgeAndGender();
            }
        } else if (hasGender) {
            console.warn("Skipping Age/Gender detection because FaceLandmarks model is missing (required for alignment).");
        }

        // Execute
        const results = await task;

        let maleCount = 0;
        let femaleCount = 0;
        let childCount = 0;

        results.forEach((res: any, index: number) => {
            const gender = res.gender || 'unknown';
            const age = res.age ? Math.round(res.age) : 30; // Default to adult if unknown

            if (age < 15) {
                childCount++;
            } else {
                if (gender === 'male') maleCount++;
                else femaleCount++; // Default to female
            }
        });

        return { maleCount, femaleCount, childCount, totalPeople: results.length };
    } catch (error: any) {
        return { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };
    }
};