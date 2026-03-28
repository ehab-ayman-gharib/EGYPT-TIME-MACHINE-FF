/**
 * FACE DETECTION SERVICE
 * ----------------------
 * Provides high-level functions for face detection using face-api.js (SSD Mobilenet V1).
 * 
 * CORE RESPONSIBILITIES:
 * 1. Environment Patching: Bridging face-api.js with browser Canvas/Fetch implementations.
 * 2. Model Loading: Downloading neural network weights from either local assets or a CDN.
 * 3. Face Inference: Detecting faces, estimating age, and determining gender.
 */

import '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import { FaceDetectionResult } from '../types';

const LOCAL_MODEL_URL = './models';
const FALLBACK_MODEL_URL = 'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights';

let modelLoadPromise: Promise<boolean> | null = null;
let backendPromise: Promise<void> | null = null;
let envPatched = false;

/**
 * 1. ENVIRONMENT PATCHING
 * face-api.js requires a DOM environment (Canvas, fetch, etc.).
 * In Electron/React, we must explicitly link the native browser APIs.
 */
const ensureEnvPatched = () => {
    if (envPatched) return;
    try {
        faceapi.env.monkeyPatch({
            fetch: window.fetch.bind(window),
            Canvas: HTMLCanvasElement,
            Image: HTMLImageElement,
            createCanvasElement: () => document.createElement('canvas'),
            createImageElement: () => document.createElement('img')
        });
        envPatched = true;
        console.log('✅ face-api.js environment patched');
    } catch (err) {
        console.warn('Environment patch failed:', err);
    }
};

/**
 * 2. GPU INITIALIZATION
 * Configures TensorFlow.js to use the WebGL backend for hardware-accelerated inference.
 * Falls back to CPU if WebGL is unavailable.
 */
const ensureBackendReady = async (): Promise<void> => {
    if (!backendPromise) {
        backendPromise = (async () => {
            try {
                await faceapi.tf.setBackend('webgl');
                await faceapi.tf.ready();
            } catch (err) {
                console.warn('WebGL fallback to CPU');
                await faceapi.tf.setBackend('cpu');
            }
        })();
    }
    return backendPromise;
};

/**
 * 3. MODEL BOOTSTRAPPING
 * Loads the required neural network models. 
 * We use SSD Mobilenet V1 for detection (Mandatory) and 
 * Age/Gender/Landmarks for auxiliary data (Recommended).
 */
export const loadFaceApiModels = async (): Promise<boolean> => {
    if (modelLoadPromise) return modelLoadPromise;

    modelLoadPromise = (async () => {
        ensureEnvPatched();
        await ensureBackendReady();

        const loadFromSource = async (baseUrl: string) => {
            // SSD Mobilenet V1: high-accuracy detector
            await faceapi.nets.ssdMobilenetv1.loadFromUri(baseUrl);
            
            // Auxiliary nets (Optional)
            try { await faceapi.nets.ageGenderNet.loadFromUri(baseUrl); } catch(e) {}
            try { await faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl); } catch(e) {}
        };

        try {
            await loadFromSource(LOCAL_MODEL_URL);
            return true;
        } catch (localError) {
            try {
                // CDN Fallback if local assets are missing
                await loadFromSource(FALLBACK_MODEL_URL);
                return true;
            } catch (cdnError) {
                return false;
            }
        }
    })();

    return modelLoadPromise;
};

/**
 * 4. FACE INFERENCE
 * Analyzes an image (Video/Canvas/Img) and extracts metadata about the people in it.
 */
export const detectFaces = async (videoElement: any, isLoaded: boolean): Promise<FaceDetectionResult> => {
    const fallback: FaceDetectionResult = { maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 };
    if (!isLoaded) return fallback;

    try {
        // DETECTOR OPTIONS: minConfidence 0.5 helps avoid false positives ("GHOSTS").
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
        
        /**
         * TASK CHAINING
         * We chain 'detectFaces' with 'withFaceLandmarks' and 'withAgeAndGender' 
         * to get full context for the FaceFusion orchestrator.
         */
        let task: any = faceapi.detectAllFaces(videoElement, options);
        
        // Face Landmarks are REQUIRED for FaceAPI to correctly align faces for Age/Gender detection.
        task = task.withFaceLandmarks().withAgeAndGender();

        const results = await task;

        // Map raw results to our app-specific Type
        const faces: any[] = results.map((res: any) => ({
            box: {
                x: res.detection.box.x,
                y: res.detection.box.y,
                width: res.detection.box.width,
                height: res.detection.box.height
            },
            gender: res.gender || 'female',
            age: res.age ? Math.round(res.age) : 30
        }));

        let maleCount = 0;
        let femaleCount = 0;
        let childCount = 0;

        results.forEach((res: any) => {
            if (res.age < 15) {
                childCount++;
            } else {
                if (res.gender === 'male') maleCount++;
                else femaleCount++;
            }
        });

        return { maleCount, femaleCount, childCount, totalPeople: results.length, faces };
    } catch (error) {
        return fallback;
    }
};