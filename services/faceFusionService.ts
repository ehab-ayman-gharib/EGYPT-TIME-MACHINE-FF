import { EraData, FaceDetectionResult, EraId } from '../types';

/**
 * Mapping of Era IDs to directory names as per FaceFusion asset structure
 */
const ERA_NAME_MAP: Record<string, string> = {
  [EraId.OLD_EGYPT]: 'Old Kingdom',
  [EraId.COPTIC_EGYPT]: 'Coptic',
  [EraId.ISLAMIC_EGYPT]: 'Islamic',
  [EraId.MODERN_EGYPT]: 'Modern'
};

/**
 * Interface for Electron IPC (provided via window.ipcRenderer or similar)
 */
declare global {
  interface Window {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
    };
  }
}

/**
 * Triggers local FaceFusion transformation via Electron IPC
 */
export const transformWithFaceFusion = async (
  imageSrc: string,
  era: EraData,
  faceData: FaceDetectionResult
): Promise<{ image: string; prompt: string }> => {
  console.log(`[FaceFusion] Starting transformation for Era: ${era.id}`);

  // 1. Orchestrator Logic: Detection & Sorting
  let genderFolder = faceData.maleCount > faceData.femaleCount ? '1M' : '1F';
  let sortedFaceBoxes: any[] = [];

  if (faceData.faces && faceData.faces.length >= 2) {
      // Step B: Sort by x coordinate (left-to-right)
      const sorted = [...faceData.faces].sort((a, b) => a.box.x - b.box.x);
      const face1 = sorted[0];
      const face2 = sorted[1];

      // Construct folder name based on sorted genders
      // M + F -> 1M_1F
      // F + M -> 1F_1M
      // M + M -> 2M
      // F + F -> 2F
      const g1 = face1.gender === 'male' ? 'M' : 'F';
      const g2 = face2.gender === 'male' ? 'M' : 'F';

      if (g1 === 'M' && g2 === 'F') genderFolder = '1M_1F';
      else if (g1 === 'F' && g2 === 'M') genderFolder = '1F_1M';
      else if (g1 === 'M' && g2 === 'M') genderFolder = '2M';
      else if (g1 === 'F' && g2 === 'F') genderFolder = '2F';

      // Take the two primary faces for the dual-swap
      sortedFaceBoxes = [face1.box, face2.box];
  }

  const eraFolderName = ERA_NAME_MAP[era.id] || era.id;
  const targetPath = `templates/${eraFolderName}/${genderFolder}`;
  
  console.log(`[FaceFusion] Folder: ${genderFolder}, Sorted Faces: ${sortedFaceBoxes.length}`);

  try {
    // 3. Obtain ipcRenderer (support both Dev and Electron environment)
    let ipc;
    if ((window as any).require) {
      ipc = (window as any).require('electron').ipcRenderer;
    } else if ((window as any).ipcRenderer) {
      ipc = (window as any).ipcRenderer;
    }

    if (!ipc) {
      throw new Error('Electron IPC not available. Are you running in a browser?');
    }

    // 4. Call Electron IPC
    const result = await ipc.invoke('execute-face-fusion', {
      sourceBase64: imageSrc,
      targetPath: targetPath,
      faces: sortedFaceBoxes
    });

    if (!result.success) {
      throw new Error(result.error || 'FaceFusion transformation failed');
    }

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
