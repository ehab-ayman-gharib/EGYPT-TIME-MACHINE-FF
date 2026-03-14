export enum AppScreen {
  SPLASH = 'SPLASH',
  ERA_SELECTION = 'ERA_SELECTION',
  CAMERA = 'CAMERA',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
}

export enum EraId {
  OLD_EGYPT = 'OLD_EGYPT',
  COPTIC_EGYPT = 'COPTIC_EGYPT',
  ISLAMIC_EGYPT = 'ISLAMIC_EGYPT',
  MODERN_EGYPT = 'MODERN_EGYPT',
  SNAP_A_MEMORY = 'SNAP_A_MEMORY',
}

export interface Scenery {
  prompt: string;
  maleClothingIds: string[];
  femaleClothingIds: string[];
}

export interface EraData {
  id: EraId;
  name: string;
  description: string;
  previewImage: string;
  scenery: Scenery[];
  stamps: string[];
  frames: string[];
  characters?: string[];
}

export interface FaceDetectionResult {
  maleCount: number;
  femaleCount: number;
  childCount: number;
  totalPeople: number;
}