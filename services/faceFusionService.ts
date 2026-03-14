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

  // 1. Determine Gender
  const gender = faceData.maleCount > faceData.femaleCount ? 'male' : 'female';
  
  // 2. Map Target Template Path
  // Actual path structure is templates/${EraName}/${gender}/template_01.jpg
  // Note: EraName in folder is "Old Kingdom"
  const eraFolderName = ERA_NAME_MAP[era.id] || era.id;
  const targetPath = `templates/${eraFolderName}/${gender}/template_01.jpg`;
  
  console.log(`[FaceFusion] Selected template: ${targetPath}`);

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
      targetPath: targetPath
    });

    if (!result.success) {
      throw new Error(result.error || 'FaceFusion transformation failed');
    }

    return {
      image: result.image,
      prompt: `Historical portrait: ${era.name} (${gender})`
    };
  } catch (error) {
    console.error('[FaceFusion] Service error:', error);
    throw error;
  }
};
