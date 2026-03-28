/**
 * FACEFUSION SERVICE
 * ------------------
 * Handles the communication between the React frontend and the Electron main process
 * for AI image processing.
 * 
 * CORE FUNCTIONALITY:
 * 1. Analyzes face detection results (gender counts and positions).
 * 2. Maps the session to a specific template folder (e.g., '1M_1F' for one male and one female).
 * 3. Sorts faces left-to-right to ensure the correct "Identity" is swapped onto the correct "Template" face.
 */

import { EraData, FaceDetectionResult, EraId } from '../types';

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

export const transformWithFaceFusion = async (
  imageSrc: string,
  era: EraData,
  faceData: FaceDetectionResult
): Promise<{ image: string; prompt: string }> => {
  console.log(`[FaceFusion] Starting transformation for Era: ${era.id}`);

  /**
   * 1. GENDER & MULTI-FACE ORCHESTRATION
   * The backend expects templates organized by gender folder combinations.
   */
  let genderFolder = faceData.maleCount > faceData.femaleCount ? '1M' : '1F';
  let sortedFaceBoxes: any[] = [];

  // Handle Dual-Face Swaps (2 People)
  if (faceData.faces && faceData.faces.length >= 2) {
      // SORTING IS CRITICAL: Sort by x-coordinate (left-to-right).
      // This allows the FaceFusion backend to pair Face[0] with the leftmost template face.
      const sorted = [...faceData.faces].sort((a, b) => a.box.x - b.box.x);
      const face1 = sorted[0];
      const face2 = sorted[1];

      // Folder Mapping Logic:
      const g1 = face1.gender === 'male' ? 'M' : 'F';
      const g2 = face2.gender === 'male' ? 'M' : 'F';

      if (g1 === 'M' && g2 === 'F') genderFolder = '1M_1F';
      else if (g1 === 'F' && g2 === 'M') genderFolder = '1F_1M';
      else if (g1 === 'M' && g2 === 'M') genderFolder = '2M';
      else if (g1 === 'F' && g2 === 'F') genderFolder = '2F';

      sortedFaceBoxes = [face1.box, face2.box];
  }

  const eraFolderName = ERA_NAME_MAP[era.id] || era.id;
  const targetPath = `templates/${eraFolderName}/${genderFolder}`;
  
  try {
    // 2. Obtain Electron IPC (supports different bridge styles)
    let ipc;
    if ((window as any).require) {
      ipc = (window as any).require('electron').ipcRenderer;
    } else if ((window as any).ipcRenderer) {
      ipc = (window as any).ipcRenderer;
    }

    if (!ipc) throw new Error('Electron IPC not available');

    // 3. EXECUTE TRANSFORMATION
    // This call is ASYNC and can take 2-10 seconds depending on hardware.
    const result = await ipc.invoke('execute-face-fusion', {
      sourceBase64: imageSrc,
      targetPath: targetPath,
      faces: sortedFaceBoxes
    });

    if (!result.success) throw new Error(result.error || 'FaceFusion failed');

    const displayGender = faceData.maleCount > faceData.femaleCount ? 'male' : 'female';
    return {
      image: result.image,
      prompt: `Historical portrait: ${era.name} (${displayGender})`
    };
  } catch (error) {
    console.error('[FaceFusion] Service error:', error);
    throw error;
  }
};
