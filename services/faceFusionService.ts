/**
 * FACEFUSION SERVICE
 * ------------------
 * This service acts as the orchestration layer between the React UI and the 
 * Electron Backend for AI face transformation. It handles gender analysis,
 * environment mapping, and group portrait ordering.
 * 
 * CORE RESPONSIBILITIES:
 * 1. Gender Accounting: Counts males/females to select the correct template subfolder.
 * 2. Identity Mapping: Sorts detected faces (L-to-R) to align identities with template characters.
 * 3. IPC Bridge: Communicates with 'electron/main.cjs' to execute the FaceFusion CLI.
 * 4. Template Analysis: Provides a global helper for the backend to locate face positions in templates.
 */

import { EraData, FaceDetectionResult, EraId } from '../types';
import * as faceapi from 'face-api.js';

/**
 * GLOBAL HELPER: analyzeTemplate
 * -----------------------------
 * This function is exposed to the window object so that the Electron Main Process 
 * can "call back" into the browser context. 
 * 
 * WHY: Face-API.js requires a DOM/Canvas environment to detect faces. By running this 
 * in the renderer, the backend can identify where "face slots" are in any template 
 * (.jpg) without needing a heavy Node-based AI setup.
 * 
 * @param templateUrl - Absolute URL or path to the template image.
 * @returns Array of face box coordinates sorted horizontally.
 */
(window as any).analyzeTemplate = async (templateUrl: string) => {
  try {
    const img = await faceapi.fetchImage(templateUrl);
    // Use high-accuracy detection with gender estimation for slot mapping
    const detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
                                   .withFaceLandmarks()
                                   .withAgeAndGender();

    // Sort slots from Left-to-Right by x-coordinate for consistent index referencing
    return detections
      .sort((a, b) => a.detection.box.x - b.detection.box.x)
      .map(d => ({
        x: d.detection.box.x,
        y: d.detection.box.y,
        width: d.detection.box.width,
        height: d.detection.box.height,
        gender: d.gender // 'male' or 'female'
      }));
  } catch (err) {
    console.error('[AnalyzeTemplate] Error during template analysis:', err);
    return [];
  }
};

/**
 * ERA_NAME_MAP
 * Maps Internal Era IDs to their corresponding folder names on the file system.
 */
const ERA_NAME_MAP: Record<string, string> = {
  [EraId.OLD_EGYPT]: 'Old Kingdom',
  [EraId.COPTIC_EGYPT]: 'Coptic',
  [EraId.ISLAMIC_EGYPT]: 'Islamic',
  [EraId.MODERN_EGYPT]: 'Modern'
};

declare global {
  interface Window {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
    };
  }
}

/**
 * transformWithFaceFusion
 * -----------------------
 * Main entry point for starting an AI transformation.
 * 
 * @param imageSrc - The source photo captured from the camera (Data URL).
 * @param era - The historical period selected by the user.
 * @param faceData - Results from the initial face-api detection pass.
 */
export const transformWithFaceFusion = async (
  imageSrc: string,
  era: EraData,
  faceData: FaceDetectionResult
): Promise<{ image: string; prompt: string }> => {
  console.log(`🚀 [FaceFusion] Transformation Start | Era: ${era.id} | People: ${faceData.faces?.length}`);

  // 1. GENDER & MULTI-FACE ORCHESTRATION
  const numFaces = faceData.faces?.length || 0;
  
  // Default: Handle single-person mapping
  let genderFolder = faceData.maleCount > faceData.femaleCount ? '1M' : '1F';
  let sortedFaces: any[] = [];
  const rawFaces = [...(faceData.faces || [])].sort((a, b) => a.box.x - b.box.x);
  const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5);

  /**
   * CASE: 1 PERSON (Single-Face Mode)
   */
  if (numFaces === 1) {
    sortedFaces = rawFaces;
  }
  /**
   * CASE: 2 PEOPLE (Dual-Face Mode)
   */
  else if (numFaces === 2) {
    const face1 = rawFaces[0];
    const face2 = rawFaces[1];
    const g1 = face1.gender === 'male' ? 'M' : 'F';
    const g2 = face2.gender === 'male' ? 'M' : 'F';

    const hasMixedPair = (g1 === 'M' && g2 === 'F') || (g1 === 'F' && g2 === 'M');
    
    if (hasMixedPair) {
      genderFolder = '1M_1F';
      // Order doesn't matter for the folder, and main.cjs handles slot mapping by gender
      sortedFaces = rawFaces;
      console.log(`🎲 [FaceFusion] Dual Mixed Pair -> Folder: ${genderFolder}`);
    } else {
      if (g1 === 'M' && g2 === 'M') {
        genderFolder = '2M';
        sortedFaces = shuffle(rawFaces);
      } else if (g1 === 'F' && g2 === 'F') {
        genderFolder = '2F';
        sortedFaces = shuffle(rawFaces);
      } else {
        // Fallback (redundant with hasMixedPair check but safe)
        genderFolder = '1M_1F';
        sortedFaces = rawFaces;
      }
    }
  } 
  
  /**
   * CASE: 3 PEOPLE (Triple-Face Mode)
   * ---------------------------------
   * Implements "Dynamic Group Mapping" based on user requirements.
   */
  else if (numFaces === 3) {
    const mFaces = rawFaces.filter(f => f.gender === 'male');
    const fFaces = rawFaces.filter(f => f.gender === 'female');
    
    // Identity Scrambling: Randomize order within gender groups
    // The backend now handles slot matching, so we just provide a randomized pool
    // to ensure users switch roles (M1/M2) even on the same template.
    const shuffledPool = [...shuffle(mFaces), ...shuffle(fFaces)];
    sortedFaces = shuffledPool;

    // Determine Folder for the backend
    if (faceData.maleCount === 3) genderFolder = '3M';
    else if (faceData.femaleCount === 3) genderFolder = '3F';
    else if (faceData.maleCount === 2) genderFolder = '2M_1F';
    else if (faceData.femaleCount === 2) genderFolder = '2F_1M';
    else genderFolder = '3M';

    console.log(`🎲 [FaceFusion] Triple-Face Shuffled Pool -> Folder: ${genderFolder}`);
  }

  // Construct the final file-system path for Electron to search
  const eraFolderName = ERA_NAME_MAP[era.id] || era.id;
  const targetPath = `templates/${eraFolderName}/${genderFolder}`;

  try {
    // 2. Obtain Electron IPC
    // Handles both standard Electron and typical dev environments.
    let ipc;
    if ((window as any).require) {
      ipc = (window as any).require('electron').ipcRenderer;
    } else if ((window as any).ipcRenderer) {
      ipc = (window as any).ipcRenderer;
    }

    if (!ipc) {
      console.error('[FaceFusion] Failed to acquire Electron IPC Renderer.');
      throw new Error('Electron IPC not available. Are you running in a browser?');
    }

    /**
     * 3. EXECUTE TRANSFORMATION
     * Executes the surgical tile isolation workflow for all person counts.
     */
    const result = await ipc.invoke('execute-face-fusion', {
      sourceBase64: imageSrc,
      targetPath: targetPath,
      faces: sortedFaces
    });

    if (!result.success) {
      throw new Error(result.error || 'The AI transformation engine encountered an error.');
    }

    const displayGender = faceData.maleCount > faceData.femaleCount ? 'male' : 'female';
    
    return {
      image: result.image,
      prompt: `Historical portrait from ${era.name} era (${displayGender} lead)`
    };

  } catch (error) {
    console.error('[FaceFusion] Service Pipeline Error:', error);
    throw error;
  }
};
