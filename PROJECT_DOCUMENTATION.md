# Egypt Time Machine - Project Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Features List](#features-list)
3. [Application Workflow](#application-workflow)
4. [Architecture](#architecture)
5. [File Structure & Functionality](#file-structure--functionality)
6. [Technical Stack](#technical-stack)
7. [Era Configurations](#era-configurations)
8. [API Integrations](#api-integrations)
9. [Build & Deployment](#build--deployment)

---

## 🎯 Project Overview

**Egypt Time Machine** is an AI-powered photobooth application that transforms user photos into historical Egyptian portraits across different eras. The application uses Google's Gemini AI to generate historically accurate images with period-appropriate clothing, scenery, and styling.

### Purpose
- Create immersive historical photo experiences for tourists at Cairo Airport
- Educate users about Egyptian history through interactive AI-generated imagery
- Provide instant, printable souvenirs with QR code sharing capabilities

### Target Platform
- **Primary**: Electron desktop application (Windows Portable EXE)
- **Secondary**: Web browser (PWA-enabled)
- **Display**: Portrait orientation (9:16 aspect ratio)

---

## ✨ Features List

### Core Features

#### 1. **Multi-Era Historical Transformation**
- **Old Kingdom Egypt** (c. 2686–2181 BC)
  - 8 unique scenery locations (Philae Temple, Great Sphinx, Karnak, etc.)
  - 3 male clothing options per scene
  - 3 female clothing options per scene
  - Historically accurate accessories and jewelry
  
- **Coptic Egypt** (c. 3rd–7th Century AD)
  - 6 unique scenery locations (Hanging Church, St. Catherine's Monastery, etc.)
  - Period-accurate tunics and religious attire
  
- **Islamic Golden Age** (c. 7th–16th Century AD)
  - 4 unique scenery locations (Mosque of Amr ibn al-As, Citadel of Saladin, etc.)
  - Traditional Islamic clothing and scholarly attire
  
- **Modern Egypt**
  - 3 contemporary scenarios (Felucca on Nile, Red Sea diving, Hot air balloon)
  - Modern casual and adventure wear
  
- **Snap a Memory**
  - Direct photo capture with decorative Egyptian frame
  - No AI transformation (instant processing)

#### 2. **Intelligent Face Detection**
- **Technology**: TensorFlow.js + face-api.js
- **Capabilities**:
  - Detects multiple faces in a single photo
  - Gender classification (male/female)
  - Age estimation (child detection for age < 15)
  - Group composition analysis
- **Models Used**:
  - SSD MobileNet V1 (primary face detection)
  - Age-Gender Net (demographic analysis)
  - Face Landmark 68 Net (facial alignment)

#### 3. **AI Image Generation**
- **Engine**: Google Gemini 2.5 Flash Image
- **Features**:
  - Identity preservation (maintains facial features)
  - **Historical Companions**: Support for generating portraits alongside figures like Queen Nefertiti, Pharaoh Thutmose III, or Goddess Isis.
  - Contextual clothing selection based on gender/age (male, female, child)
  - Dynamic scenery selection with anti-repetition logic (localStorage tracked)
  - Safety settings configured for historical content (BLOCK_NONE)
  - Automatic retry mechanism (up to 3 attempts with 500ms delay)

#### 4. **Local FaceFusion Transformation (High-Fidelity)**
- **Technology**: FaceFusion 3.3.0 (Local Execution)
- **Features**:
- **Single Face Swap**: Optimized for high-fidelity personal portraits.
- **Cross-Platform Support**: 
  - Windows: CUDA acceleration (NVIDIA GPU).
  - macOS: CoreML acceleration (Apple Silicon).
- **Processors**: `face_swapper` (Inswapper 128 FP16) + `face_enhancer` (GFPGAN 1.4).
- **Template System**: Curated historical templates located in `public/templates/`.
- **Randomization**: Automatically picks a random template from gender-specific folders (1M/1F) within era directories.
- **ASAR Support**: Automatic manual extraction of templates from ASAR when running in packaged Electron environments.
#### 5. **Orchestrator Logic: 2-Pass Sequential Anchor (Dual Portraits)**
- **Purpose**: Solves gender-mismatch placement and face duplication in historical templates.
- **Pre-Flight Stability (4K Support)**: Normalizes images > 2048px to prevent GPU memory crashes while scaling detection coordinates proportionally.
- **Order of Operations (The "Surgical Prep")**:
  1. **High-Res Smart Crop**: Extracts a 2.2x zoom buffer from the large original file. This "Smart Slice" keeps distant subjects high-fidelity.
  2. **Neighbor Cloaking (The Blur)**: Locates neighbor faces within that slice and applies a **Heavy Gaussian Blur (Sigma 20)** with an **8% Directional Offset**. This "cloaks" them from the AI detector without leaving black artifacts.
  3. **Proportional Upscale**: Resizes the pre-cleaned high-res crop to exactly 512px wide for optimal FaceFusion detection.
- **Surgical Accuracy**: The blur destroys foreign landmarks (eyes/nose/mouth) so the AI physically cannot detect the neighbor, while the "flesh-tone" blurring prevents the Face Enhancer from creating dark artifacts.
- **Sequential Execution**:
  - **Pass 1 (Left)**: Swaps the left-most face onto the template using `left-right` ordering and ultra-sensitive detection scores (`Detector 0.15`).
  - **Pass 2 (Right)**: Swaps the right-most face onto the Pass 1 result using `right-left` ordering + `face_enhancer` + `face_swapper`.
- **Detection Stability**: Landmarker score set to `0.0` to force detection on difficult, dark, or textured historical templates.

#### 6. **Image Composition System**
- **Layered Approach**:
  1. **Base Layer**: Era-specific background (1800x2700px)
  2. **Middle Layer**: AI-generated/captured photo (Fitted to 1800x2700 canvas)
  3. **Top Layer**: Decorative frame (Borderless overlay)
- **Background Selection**:
  - Old Egypt: Dedicated textured background
  - Other eras: Generic background
- **Frame System**: Era-specific decorative borders

#### 5. **Camera & Upload Capabilities**
- **Live Camera Feed**: Real-time webcam capture
- **File Upload**: Support for JPG/PNG images
- **Countdown Timer**: 3-second countdown before capture
- **Preview System**: Live face detection overlay

#### 6. **Printing Integration**
- **Electron IPC**: Direct communication with system printers via `print-image` handler.
- **Platform-Specific Logic**:
  - **Windows**: Uses Shell Image Print engine (`shimgvw.dll`) for high-quality borderless output.
  - **macOS/Linux**: Uses native `lp` command with `fit-to-page` scaling, specifically configured for **DNP DP-QW410** paper sizes.
- **Printer Selection**: 
  - Dynamic printer list retrieval.
  - Fuzzy matching for "DNP", "QW410", or "DS620" printers (also compatible with SELPHY).
  - Remembers last used printer in `printer-config.json`.
- **Print Specifications**:
  - Standard photobooth size: 100mm x 148mm (4x6 inches).
  - Target Resolution: **1800 x 2700 pixels** (450 DPI for ultra-sharpness).
  - Minimum Requirement: **1200 x 1800 pixels** (300 DPI for standard quality).
  - Silent printing enabled.
- **Fallback**: Browser print dialog for web-only environments.

#### 7. **QR Code Sharing**
- **Upload API**: `https://qr-web-api.vercel.app/upload`
- **Features**:
  - Automatic image upload to cloud
  - QR code generation for mobile sharing
  - Retry logic with exponential backoff
  - Error handling for network issues

#### 8. **Download & Export**
- **Format**: PNG (high quality, 0.9 compression)
- **Filename**: `egypt-time-machine-{timestamp}.png`
- **Resolution**: 1800x2700px (Optimized for 4x6 professional prints)

#### 9. **Analytics Integration**
- **Dashboard API**: Tracks generated image count
- **Endpoint**: `https://ai-photobooth-dashboard.vercel.app/api/projects/ee7c55cd-39d5-481c-84e5-691c1a3f100e/generate`
- **Metrics**: Increments counter after successful generation

#### 10. **User Experience Enhancements**
- **3D Animated Background**: Three.js particle system on splash screen
- **Background Music**: Looping audio with mute toggle
- **Loading States**: Visual feedback during processing
- **Error Handling**: Automatic retry and graceful fallbacks
- **Session Management**: Clean state reset between sessions

---

## 🔄 Application Workflow

### User Journey Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        1. SPLASH SCREEN                         │
│  • 3D animated background (Three.js particles)                  │
│  • Background music with mute toggle                            │
│  • Era selection cards (5 options)                              │
│  • Click era card to proceed                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      2. CAMERA CAPTURE                          │
│  • Initialize webcam stream                                     │
│  • Load face detection models (TensorFlow.js)                   │
│  • Display live camera feed                                     │
│  • Real-time face detection overlay                             │
│  • Options: Capture Photo | Upload File | Go Back              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. FACE DETECTION                            │
│  • Analyze captured/uploaded image                              │
│  • Detect faces using SSD MobileNet V1                          │
│  • Classify gender and estimate age                             │
│  • Generate FaceDetectionResult object:                         │
│    - maleCount, femaleCount, childCount, totalPeople            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. PROCESSING PHASE                          │
│  • Display loading screen overlay                               │
│  • Branch based on selected era:                                │
│                                                                  │
│  IF "Snap a Memory":                                            │
│    → Skip AI generation                                         │
│    → Use original photo                                         │
│    → 1 second delay for UX consistency                          │
│                                                                  │
│  IF Historical Era (Old/Coptic/Islamic/Modern):                 │
│    → Select random scenery (anti-repetition logic)              │
│    → Choose clothing based on gender/age                        │
│    → Build AI prompt with identity preservation rules           │
│    → Send to Gemini 2.5 Flash Image API                         │
│    → Retry up to 3 times on failure                             │
│    → Increment dashboard analytics counter                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   5. IMAGE COMPOSITION                          │
│  • Create 1080x1920px canvas                                    │
│  • Layer 1: Draw era-specific background                        │
│  • Layer 2: Draw AI-generated/original photo (75% size)         │
│  • Layer 3: Draw decorative frame (92% size)                    │
│  • Export as PNG data URL                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     6. RESULT SCREEN                            │
│  • Display final composed image                                 │
│  • Action buttons:                                              │
│    - Download: Save PNG to device                               │
│    - Print: Send to DNP professional photo printer              │
│    - QR Code: Upload & generate shareable QR                    │
│    - New Adventure: Restart flow                                │
│                                                                  │
│  • QR Code Generation Flow:                                     │
│    1. Upload image to qr-web-api.vercel.app                     │
│    2. Receive QR code URL                                       │
│    3. Display QR code for mobile scanning                       │
│    4. Handle errors with retry logic                            │
│                                                                  │
│  • Printing Flow (Electron):                                    │
│    1. Get available printers via IPC                            │
│    2. Load saved printer preference (DP-QW410)                  │
│    3. Save image and invoke native print command                │
│    4. Send to printer (100x148mm, borderless)                  │
│    5. Show success/error feedback                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                  User chooses action:
                  • Download → File saved
                  • Print → Sent to printer
                  • QR Code → Shareable link
                  • New Adventure → Return to Step 1
```

### State Management Flow

```typescript
AppScreen States:
├── SPLASH          → Initial landing + Era selection
├── ERA_SELECTION   → (Merged with SPLASH)
├── CAMERA          → Live camera feed + capture
├── PROCESSING      → AI generation in progress
└── RESULT          → Final image display + actions

Session State Variables:
├── selectedEra: EraData | null
├── generatedImage: string | null
├── generatedPrompt: string
├── faceDetectionResult: FaceDetectionResult | null
├── sessionKey: number (increments on restart)
└── isMuted: boolean (audio toggle)
```

---

## 🏗️ Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  React 19.2.1          │  UI Framework                      │
│  TypeScript 5.8.2      │  Type Safety                       │
│  Lucide React          │  Icon Library                      │
│  Three.js 0.160.0      │  3D Graphics (Splash Screen)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    AI/ML LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  Google Gemini API     │  Cloud Image Generation            │
│  FaceFusion 3.3.0      │  Local High-Fidelity face swap     │
│  TensorFlow.js 1.7.4   │  Client-side ML Runtime            │
│  face-api.js 0.22.2    │  Face Detection                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   BUILD & RUNTIME LAYER                     │
├─────────────────────────────────────────────────────────────┤
│  Vite 6.2.0            │  Build Tool & Dev Server           │
│  Electron 39.2.7       │  Desktop Runtime                   │
│  Python 3.10+          │  FaceFusion Backend Logic          │
│  Conda / Virtualenv    │  Python Environment Management     │
│  Electron Builder      │  Packaging (Windows Portable)      │
│  Vite PWA Plugin       │  Progressive Web App               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                         │
├─────────────────────────────────────────────────────────────┤
│  Gemini 2.5 Flash      │  ai.google.dev                     │
│  QR Upload API         │  qr-web-api.vercel.app             │
│  Analytics Dashboard   │  ai-photobooth-dashboard.vercel... │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
App.tsx (Root)
├── SplashScreen
│   ├── Three.js Scene (Animated Background)
│   ├── Audio Player (Background Music)
│   ├── Mute Toggle Button
│   └── Era Selection Cards (5 eras)
│
├── CameraCapture
│   ├── Video Stream (getUserMedia)
│   ├── Face Detection Overlay
│   ├── Capture Button (with countdown)
│   ├── File Upload Input
│   └── Back Button
│
├── LoadingScreen
│   └── Spinner Animation
│
└── ResultScreen
    ├── Image Display
    ├── Action Buttons
    │   ├── Download
    │   ├── Print (Electron only)
    │   ├── QR Code Share
    │   └── New Adventure
    ├── QR Code Modal
    └── Printer Selection Modal
```

### Service Layer

```
services/
├── geminiService.ts
│   ├── generateHistoricalImage()
│   │   ├── Scene selection (anti-repetition)
│   │   ├── Clothing selection (gender-based)
│   │   ├── Prompt construction
│   │   └── Gemini API call
│   └── incrementGeneratedCount()
│
├── faceService.ts
│   ├── loadFaceApiModels()
│   │   ├── Environment patching
│   │   ├── TensorFlow backend init
│   │   └── Model loading (local → CDN fallback)
│   └── detectFaces()
│       ├── SSD MobileNet V1 detection
│       ├── Age/Gender classification
│       └── Result aggregation
│
├── faceFusionService.ts
│   └── transformWithFaceFusion()
│       ├── Gender mapping (male/female → 1M/1F)
│       ├── Era path mapping
│       └── IPC call to 'execute-face-fusion'
│
└── stampService.ts
    └── applyEraStamp()
        ├── Background layer
        ├── Photo layer (scaling & centering)
        └── Frame layer (overlay)
```

---

## 📁 File Structure & Functionality

### Root Files

#### `App.tsx`
**Purpose**: Main application component and state orchestrator

**Key Responsibilities**:
- Screen navigation (SPLASH → CAMERA → PROCESSING → RESULT)
- Global state management (era, image, face data)
- Error handling with retry logic (3 attempts)
- Session management (reset on restart)

**Key Functions**:
- `handleStart()`: Navigate to era selection
- `handleEraSelect(era)`: Set selected era and show camera
- `handleCapture(imageSrc, faceData)`: Process image (AI or direct)
- `handleRestart()`: Reset all state and return to splash
- `handleUpdateImage(newImage)`: Update generated image (for QR upload)

**State Variables**:
```typescript
currentScreen: AppScreen
selectedEra: EraData | null
generatedImage: string | null
generatedPrompt: string
faceDetectionResult: FaceDetectionResult | null
sessionKey: number
isMuted: boolean
```

---

#### `constants.ts`
**Purpose**: Configuration data for all eras and AI prompts

**Contents**:
- `SHARED_PROMPT_INSTRUCTIONS`: Base AI generation rules
- `IDENTITY_PRESERVATION_GUIDE`: Face preservation requirements
- `ERAS`: Array of 5 era configurations

**Era Data Structure**:
```typescript
{
  id: EraId,
  name: string,
  description: string,
  previewImage: string,
  scenery: Scenery[],  // Multiple locations per era
  stamps: string[],     // Decorative stamps (legacy)
  frames: string[]      // Decorative frames
}
```

**Scenery Structure**:
```typescript
{
  prompt: string,              // Location description
  maleClothingIds: string[],   // 3 male outfit options
  femaleClothingIds: string[]  // 3 female outfit options
}
```

**Key Features**:
- **Old Egypt**: 8 scenes, 3 male/female outfits each
- **Coptic Egypt**: 6 scenes, 3 outfits each
- **Islamic Egypt**: 4 scenes, 3 outfits each
- **Modern Egypt**: 3 scenes, simple outfit descriptions
- **Snap a Memory**: No scenery (direct capture)

---

#### `types.ts`
**Purpose**: TypeScript type definitions

**Enums**:
```typescript
AppScreen: SPLASH | ERA_SELECTION | CAMERA | PROCESSING | RESULT
EraId: OLD_EGYPT | COPTIC_EGYPT | ISLAMIC_EGYPT | MODERN_EGYPT | SNAP_A_MEMORY
```

**Interfaces**:
```typescript
Scenery: { prompt, maleClothingIds, femaleClothingIds }
EraData: { id, name, description, previewImage, scenery, stamps, frames }
FaceDetectionResult: { maleCount, femaleCount, childCount, totalPeople }
```

---

#### `index.tsx`
**Purpose**: React application entry point

**Functionality**:
- Renders `App` component into `#root` div
- Strict mode enabled for development checks

---

#### `index.html`
**Purpose**: HTML template and asset preloading

**Key Features**:
- Viewport configured for portrait orientation
- Preloads critical assets (backgrounds, frames, logos)
- TailwindCSS CDN for styling
- Google Fonts: Cinzel Decorative (headings), Lora (body)

---

### Components

#### `components/SplashScreen.tsx`
**Purpose**: Landing page with era selection

**Features**:
- **3D Background**: Three.js particle system
  - 5000 particles in random positions
  - Slow rotation animation
  - Responsive canvas sizing
- **Background Music**: Looping audio with mute toggle
- **Era Cards**: 5 clickable cards with preview images
- **Responsive Layout**: Grid layout for era selection

**Key Functions**:
- `unmuteVideo()`: Enables audio playback
- `handleEraClick(era)`: Selects era and navigates
- `animate()`: Three.js render loop
- `handleResize()`: Adjusts canvas on window resize

**Props**:
```typescript
onStart: () => void
onSelectEra: (era: EraData) => void
isMuted: boolean
setIsMuted: (muted: boolean) => void
```

---

#### `components/CameraCapture.tsx`
**Purpose**: Camera interface and image capture

**Features**:
- **Live Camera Feed**: getUserMedia API
- **Face Detection**: Real-time overlay (optional)
- **Countdown Timer**: 3-second countdown before capture
- **File Upload**: Alternative to camera capture
- **Model Loading**: Lazy loads TensorFlow models

**Key Functions**:
- `init()`: Initialize camera stream
- `handleFileUpload()`: Trigger file input
- `handleFileSelect(event)`: Process uploaded file
- `startCaptureSequence()`: Begin countdown and capture

**State Variables**:
```typescript
stream: MediaStream | null
isModelLoaded: boolean
isCapturing: boolean
countdown: number | null
error: string | null
```

**Props**:
```typescript
era: EraData | null
onCapture: (image: string, faceData: FaceDetectionResult) => void
onBack: () => void
isProcessing?: boolean
```

---

#### `components/ResultScreen.tsx`
**Purpose**: Display final image with action buttons

**Features**:
- **Image Display**: Full-screen portrait image
- **Download**: Save as PNG
- **Print**: Electron IPC or browser print
- **QR Code**: Upload and generate shareable link
- **Printer Selection**: Dropdown for available printers

**Key Functions**:
- `uploadImage()`: Upload to QR API with retry logic
- `handleDownload()`: Save image to device
- `handlePrint()`: Send to printer (Electron) or browser
- `browserPrint()`: Fallback print using window.print()
- `handlePrinterChange(name)`: Update selected printer

**State Variables**:
```typescript
qrCodeUrl: string | null
isGeneratingQR: boolean
qrError: string | null
availablePrinters: string[]
selectedPrinter: string
isPrinting: boolean
printStatus: 'idle' | 'printing' | 'success' | 'error'
```

**Props**:
```typescript
imageSrc: string
prompt: string
era: EraData
faceData: FaceDetectionResult | null
onRestart: () => void
onUpdateImage: (newImage: string) => void
```

---

#### `components/LoadingScreen.tsx`
**Purpose**: Simple loading overlay

**Features**:
- Centered spinner animation
- Semi-transparent dark background
- "Processing your image..." text

---

### Services

#### `services/geminiService.ts`
**Purpose**: AI image generation using Google Gemini

**Key Functions**:

##### `generateHistoricalImage(base64Image, era, faceData)`
**Process**:
1. **Subject Description**: Build description from face data
   - Single person: "a man" / "a woman" / "a child"
   - Multiple: "a group of 2 men and 1 woman"
   
2. **Historical Companions**: 
   - Randomly optionally includes famous figures:
     - **Queen Nefertiti**: Iconic blue cap crown & Wesekh collar.
     - **Pharaoh Thutmose III**: Blue War Crown (Khepresh).
     - **Goddess Isis**: Sun disk with cow horns.
   
3. **Scene Selection**: Random with anti-repetition
   - Stores last scene index in localStorage under `extra_last_scenes`.
   - Tries up to 10 times to avoid repeating the same scene twice in a row.
   
4. **Clothing Selection**: Random from era-specific options
   - Separate male/female/child clothing paths.
   - Detailed historical descriptions compiled into the prompt.
   
5. **Prompt Construction**: Combine all elements
   - Scene description
   - Subject description
   - Clothing details
   - **Identity Preservation**: Uses `IDENTITY_PRESERVATION_GUIDE` constants.
   
6. **API Call**: Send to Gemini 2.5 Flash Image
   - Temperature: 0.5 (for better consistency)
   - Aspect ratio: 9:16
   - Safety settings: BLOCK_NONE for all categories.
   
7. **Response Handling**: Extract base64 image
   - Logs safety ratings and finish reasons.
   - Triggers analytics increment on success.

**Configuration**:
```typescript
Model: "gemini-2.5-flash-image"
Temperature: 0.5
Aspect_Ratio: "9:16"
SafetySettings: BLOCK_NONE (Hate, Sexual, Dangerous, Harassment, Integrity)
```

##### `incrementGeneratedCount()`
**Purpose**: Track analytics on dashboard
- Endpoint: POST to dashboard API
- Silent failure (doesn't block generation)

---

#### `services/faceService.ts`
**Purpose**: Face detection and demographic analysis

**Key Functions**:

##### `loadFaceApiModels()`
**Process**:
1. **Environment Patching**: Configure face-api.js for browser
   - Patch fetch implementation
   - Set Canvas/Image constructors
   
2. **Backend Initialization**: TensorFlow.js setup
   - Try WebGL backend first
   - Fallback to CPU if WebGL fails
   
3. **Model Loading**: Load from local → CDN fallback
   - **Primary**: SSD MobileNet V1 (required)
   - **Auxiliary**: Age-Gender Net (optional)
   - **Auxiliary**: Face Landmark 68 Net (optional)
   
4. **Verification**: Check model params loaded correctly

**Model URLs**:
- Local: `./models`
- CDN: `https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights`

##### `detectFaces(videoElement, isLoaded)`
**Process**:
1. **Validation**: Check if models are loaded
2. **Detection**: Run SSD MobileNet V1
   - minConfidence: 0.5 (filter false positives)
3. **Classification**: Add age/gender if models available
4. **Aggregation**: Count males, females, children
   - Child threshold: age < 15
   - Default to female if gender unknown

**Return**:
```typescript
{
  maleCount: number,
  femaleCount: number,
  childCount: number,
  totalPeople: number
}
```

**Fallback**: Returns `{ maleCount: 0, femaleCount: 1, childCount: 0, totalPeople: 1 }` on error

---

#### `services/stampService.ts`
**Purpose**: Composite final image with background and frame

**Key Function**: `applyEraStamp(imageSrc, era)`

**Process**:
1. **Asset Loading**: Load 3 images asynchronously
   - Main image (AI-generated or captured)
   - Background (era-specific or generic)
   - Frame (decorative border)
   
2. **Canvas Setup**: Create 1080x1920px canvas
   
3. **Layer 1 - Background**: Draw full canvas
   
4. **Layer 2 - Photo**: Scale and center
   - Display size: 75% of canvas (810x1440px)
   - Maintain aspect ratio
   - Center on canvas
   
5. **Layer 3 - Frame**: Overlay border
   - Display size: 92% of canvas (993.6x1766.4px)
   - Larger than photo to create border effect
   - Center on canvas
   
6. **Export**: Convert to PNG data URL (0.9 quality)

**Background Selection Logic**:
```typescript
if (era.id === EraId.OLD_EGYPT) {
  background = './Backgrounds/Old-Egyptian/Old-Egyptian-Background.jpg'
} else {
  background = './Backgrounds/Generic-Background.jpg'
}
```

**Legacy Code**: Stamping/branding logic is commented out (per user request)

---

### Configuration Files

#### `vite.config.ts`
**Purpose**: Vite build configuration

**Key Settings**:
- **Base Path**: `./` (relative for Electron)
- **Dev Server**: Port 3000, host 0.0.0.0
- **Environment Variables**: Injects `GEMINI_API_KEY` as `process.env.API_KEY`
- **PWA Plugin**: Configured for offline support
  - Max cache size: 5 MiB
  - Fullscreen display
  - Portrait orientation
- **Alias**: `@` resolves to project root

---

#### `package.json`
**Purpose**: Project metadata and dependencies

**Scripts**:
- `dev`: Start Vite dev server
- `build`: Build for production
- `preview`: Preview production build
- `electron:dev`: Run Electron in development
- `electron:build`: Build Electron app

**Key Dependencies**:
- `@google/genai`: ^1.32.0
- `react`: ^19.2.1
- `@tensorflow/tfjs`: ^1.7.4
- `face-api.js`: ^0.22.2
- `three`: 0.160.0

**Electron Build Config**:
- App ID: `com.egypt.timemachine`
- Output: `release/` directory
- Windows: Portable EXE
- Mac: DMG (with hardened runtime)

---

#### `tsconfig.json`
**Purpose**: TypeScript compiler configuration

**Key Settings**:
- Target: ES2020
- Module: ESNext
- JSX: react-jsx
- Strict mode enabled

---

#### `.env.local`
**Purpose**: Environment variables (not committed to git)

**Variables**:
- `GEMINI_API_KEY`: Google AI API key

---

### Electron Files

#### `electron/main.cjs`
**Purpose**: Electron main process

**Key Functions**:

##### `createWindow()`
- Window size: 1200x800 (dev), fullscreen (production)
- Node integration enabled
- Auto-hide menu bar
- Load from localhost (dev) or dist (production)

##### `getPrinterConfig()`
- Reads `printer-config.json`
- Returns saved printer name
- Handles missing config gracefully

##### IPC Handlers:

**`get-printers`**:
- Returns list of available printers
- Includes saved printer config

**`print-image`**:
- Saves base64 image to OS temporary directory.
- Detects host platform (Windows vs macOS).
- **Windows Command**: `rundll32.exe ... shimgvw.dll,ImageView_PrintTo /pt`
- **macOS Command**: `lp -d {printer} -o fit-to-page -o PageSize=dnp4x6`
- Returns success or failure reason.
- Automatically cleans up temporary files after 10 seconds.

**Print Specifications**:
```javascript
{
  silent: true,
  printBackground: true,
  deviceName: printerName,
  margins: { marginType: 'none' },
  pageSize: { width: 100000, height: 148000 }, // microns
  landscape: false
}
```

---

#### `printer-config.json`
**Purpose**: Store last used printer

**Format**:
```json
{
  "win32": "DP-QW410",
  "darwin": "Dai_Nippon_Printing_DP_QW410"
}
```

---

### Utility Files

#### `GenderDetectionService.ts`
**Purpose**: Legacy gender detection service (not currently used)

**Note**: This file appears to be an older implementation. The active face detection logic is in `services/faceService.ts`.

**Functionality**:
- Similar to faceService.ts
- Uses Tiny Face Detector instead of SSD MobileNet V1
- Class-based implementation
- Returns single gender (not group analysis)

---

## 🎨 Era Configurations

### Old Kingdom Egypt

**Scenery Count**: 8 locations

**Locations**:
1. Philae Temple Quay
2. Great Sphinx & Obelisks
3. Karnak Hypostyle Hall
4. Royal Palace Terrace
5. Luxor Temple Courtyard
6. Valley of the Kings Tomb
7. Temple of Hatshepsut Terrace
8. Abu Simbel

**Clothing Options**: 3 male, 3 female per scene

**Example Male Outfits**:
- Pharaoh's Regalia (gold Wesekh collar, Nemes headdress)
- High Priest of Amun (leopard-skin sash, gold pectoral)
- Royal Fan Bearer (ceremonial ostrich feather fan)

**Example Female Outfits**:
- Great Royal Wife (Vulture Headdress, gold Usekh collar)
- Royal Princess (gold and turquoise faience)
- High Priestess (gold circlet with lotus motif)

**Frames**: 1 decorative frame
**Background**: Dedicated Old Egyptian background

---

### Coptic Egypt

**Scenery Count**: 6 locations

**Locations**:
1. Deir Mar Girgis (Church of St. George)
2. The Hanging Church (Al-Muallaqa)
3. Deir Sam3an Kharaz (St. Simon the Tanner)
4. The Coptic Museum
5. Ancient Monastery Complex
6. Saint Catherine's Monastery

**Clothing Options**: 3 male, 3 female per scene

**Example Male Outfits**:
- Coptic Wool Tunic (dark green with red/beige bands)
- Merchant's Tunic (purple Clavi stripes)
- Monk's Habit (dark brown with rope belt)

**Example Female Outfits**:
- Square-Neck Tunic (embroidered neckline)
- Decorated Tunic (saffron-yellow with woven collar)
- Simple Tunic (terracotta with woven roundels)

**Frames**: 1 decorative frame
**Background**: Generic background

---

### Islamic Golden Age

**Scenery Count**: 4 locations

**Locations**:
1. Mosque of Amr ibn al-As
2. Citadel of Saladin
3. Sultan Hassan Mosque
4. Ibn Tulun Mosque

**Clothing Options**: 3 male, 3 female per scene

**Example Male Outfits**:
- Egyptian Scribe (linen Qamis, white turban)
- Mamluk Notable (red velvet Qaba, gold embroidery)
- Sunni Al-Azhar Scholar (white Farajiyya robe)

**Example Female Outfits**:
- Early Cairo style (linen Izar, cream headscarf)
- Ayyubid Noblewoman (sapphire-blue Jubba, white wimple)
- Mamluk Aristocrat (emerald damask coat, jeweled headband)

**Frames**: 1 decorative frame
**Background**: Generic background

---

### Modern Egypt

**Scenery Count**: 3 locations

**Locations**:
1. Felucca boat on Nile River (Cairo skyline)
2. Underwater Red Sea (coral reefs, tropical fish)
3. Hot air balloon over Luxor (Valley of the Kings view)

**Clothing Options**: Simple modern descriptions

**Example Outfits**:
- Male: "stylish casual polo shirt and chinos"
- Female: "fashionable summer dress and sun hat"

**Frames**: 2 decorative frames
**Background**: Generic background

---

### Snap a Memory

**Scenery Count**: 0 (no AI transformation)

**Process**: Direct photo capture with frame overlay

**Frames**: 1 decorative frame (shared with Modern Egypt)
**Background**: Generic background

---

## 🔌 API Integrations

### 1. Google Gemini API

**Endpoint**: Via `@google/genai` SDK
**Model**: `gemini-2.5-flash-image`

**Configuration**:
```typescript
{
  model: 'gemini-2.5-flash-image',
  config: {
    temperature: 1,
    imageConfig: {
      aspectRatio: "9:16"
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
    ]
  }
}
```

**Input**:
- Base64 image (JPEG)
- Text prompt (detailed historical description)

**Output**:
- Base64 image (JPEG, 9:16 aspect ratio)
- Finish reason
- Safety ratings

**Error Handling**:
- Retry up to 3 times
- 500ms delay between retries
- Reset to splash screen on total failure

---

### 2. Local FaceFusion Integration

**IPC Channel**: `execute-face-fusion`
**Backend Engine**: Python-based FaceFusion 3.3.0

**Workflow**:
1. **Source Capture**: UI saves captured frame as base64.
2. **Template Mapping**: `faceFusionService.ts` determines target path (e.g., `templates/Old Kingdom/1M`).
3. **Execution**:
   - UI invokes IPC with `sourceBase64` and `targetPath`.
   - Main process normalizes paths and extracts templates from ASAR if necessary.
   - Command triggers `facefusion.py headless-run`.
4. **Platform Optimization**:
   - **Windows**: Uses `--execution-providers cuda`.
   - **macOS**: Uses `--execution-providers coreml`.
5. **Output**: Returns generated image as base64 back to UI.

**Configuration (`printer-config.json`)**:
- `condaEnv`: Name of the environment (e.g., "facefusion").
- `condaPath`: Path to `conda` executable.
- `facefusionDir`: Absolute path to FaceFusion installation directory.

---

### 3. QR Code Upload API

**Endpoint**: `https://qr-web-api.vercel.app/upload`
**Method**: POST (multipart/form-data)

**Request**:
```typescript
FormData {
  image: Blob (PNG file)
}
```

**Response**:
```json
{
  "qrCodeUrl": "https://qr-web-api.vercel.app/qr/[id]"
}
```

**Error Handling**:
- Retry up to 3 times
- Exponential backoff (1s, 2s, 4s)
- Display error message to user
- CORS handling

---

### 3. Analytics Dashboard API

**Endpoint**: `https://ai-photobooth-dashboard.vercel.app/api/projects/ee7c55cd-39d5-481c-84e5-691c1a3f100e/generate`
**Method**: POST

**Request**:
```json
{}
```

**Purpose**: Increment generated images counter

**Error Handling**:
- Silent failure (doesn't block generation)
- Logs warning on failure

---

## 🚀 Build & Deployment

### Development

**Prerequisites**:
- Node.js (v16+)
- npm

**Setup**:
```bash
# Install dependencies
npm install

# Set environment variable
# Create .env.local file with:
GEMINI_API_KEY=your_api_key_here

# Run development server
npm run dev
# Opens at http://localhost:3000
```

**Electron Development**:
```bash
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron
npm run electron:dev
```

**FaceFusion Setup (Required for Transformation)**:
- Install [FaceFusion 3.3.0](https://github.com/facefusion/facefusion)
- Create a Conda environment (recommended)
- Update `printer-config.json` with your local paths:
```json
{
  "win32": {
    "printerName": "DP-QW410",
    "condaEnv": "facefusion",
    "facefusionDir": "C:/tools/facefusion"
  },
  "darwin": {
    "printerName": "DNP_QW410",
    "condaEnv": "facefusion",
    "facefusionDir": "/Users/name/facefusion"
  }
}
```

---

### Production Build

**Web Version**:
```bash
npm run build
# Output: dist/ directory
# Deploy to any static hosting (Vercel, Netlify, etc.)
```

**Electron Version**:
```bash
npm run electron:build
# Output: release/ directory
# Windows: Egypt Time Machine.exe (portable)
# Mac: Egypt Time Machine.dmg
```

---

### Deployment Checklist

**Before Building**:
1. ✅ Set `GEMINI_API_KEY` in `.env.local`
2. ✅ Test all eras with sample photos
3. ✅ Verify face detection accuracy
4. ✅ Test printer integration (Electron only)
5. ✅ Test QR code upload
6. ✅ Check analytics tracking
7. ✅ Verify all assets are in `public/` folder:
   - Backgrounds (Old-Egyptian, Generic)
   - Frames (per era)
   - Templates (for FaceFusion)
   - Stamps (per era)
   - Logos
   - Models (face-api.js weights)
   - Audio files
   - Preview images

**Asset Structure**:
```
public/
├── Backgrounds/
│   ├── Old-Egyptian/
│   │   └── Old-Egyptian-Background.jpg
│   └── Generic-Background.jpg
├── Frames/
│   ├── Old-Egyptian/
│   │   └── 1.png
│   ├── Coptic/
│   │   └── 1.png
│   ├── Islamic/
│   │   └── 1.png
│   └── Modern-Egypt/
│       ├── 1.png
│       └── 2.png
├── Stamps/
│   ├── Old-Egyptian/
│   │   ├── 1.png
│   │   ├── 2.png
│   │   └── 3.png
│   ├── Coptic/
│   │   ├── 1.png
│   │   ├── 2.png
│   │   └── 3.png
│   ├── Islamic/
│   │   ├── 1.png
│   │   ├── 2.png
│   │   ├── 3.png
│   │   └── 4.png
│   └── Modern-Egypt/
│       └── 1.png
├── Logos/
│   ├── Gold-Logo.png
│   └── Original-Logo.png
├── models/
│   ├── ssd_mobilenetv1_model-weights_manifest.json
│   ├── ssd_mobilenetv1_model-shard1
│   ├── age_gender_model-weights_manifest.json
│   ├── age_gender_model-shard1
│   ├── face_landmark_68_model-weights_manifest.json
│   └── face_landmark_68_model-shard1
├── Old-Egypt-Preview.png
├── Coptic-Preview.png
├── Islamic-Preview.png
├── Modern-Preview.png
├── Snap-A-Memory.png
└── icon.png
```

---

### Electron Packaging Notes

**Windows Portable**:
- No installation required
- Single .exe file
- Includes all dependencies
- Printer integration works out-of-box

**Mac DMG**:
- Requires code signing for distribution
- Hardened runtime enabled
- Gatekeeper assessment disabled (for testing)

**Included Files**:
- `dist/` (built web app)
- `electron/main.cjs`
- `printer-config.json`
- `public/templates/` (Essential for FaceFusion)

---

## 📊 Performance Considerations

### Optimization Strategies

**Image Processing**:
- Canvas operations are synchronous (blocking)
- Large images (1080x1920) can cause brief freezes
- Consider Web Workers for heavy processing

**Face Detection**:
- Models loaded once and cached
- Detection runs on every frame (camera mode)
- Can be throttled to reduce CPU usage

**AI Generation**:
- Average response time: 5-15 seconds
- Retry logic adds 0.5s delay per attempt
- Network-dependent

**Asset Loading**:
- Backgrounds/frames preloaded in HTML
- Models lazy-loaded on camera screen
- Three.js scene initialized on splash screen

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **Face Detection Accuracy**:
   - May misclassify gender (defaults to female)
   - Age estimation can be off by 5-10 years
   - Struggles with masks, sunglasses, or poor lighting

2. **AI Generation**:
   - Occasional identity drift (face changes slightly)
   - Clothing may not always match prompt exactly
   - Background architecture can be distorted
   - Safety filters may block legitimate historical content

3. **Printing**:
   - Only works in Electron (not web version)
   - Optimized for **DNP DP-QW410** or DS620 printers
   - Print preview not available

4. **QR Code Upload**:
   - Dependent on external API availability
   - Large images may timeout
   - No expiration date on uploaded images

5. **Browser Compatibility**:
   - Requires modern browser with WebGL support
   - Camera access requires HTTPS (except localhost)
   - Safari may have issues with face-api.js

---

## 🔒 Security & Privacy

### Data Handling

**User Photos**:
- Never stored on server (except QR upload)
- Processed client-side (face detection)
- Sent to Gemini API for generation
- QR upload is optional

**API Keys**:
- Stored in `.env.local` (not committed)
- Injected at build time
- Exposed in client bundle (consider backend proxy)

**Analytics**:
- Only tracks generation count (no PII)
- No user identification

---

## 📝 Future Enhancements

### Potential Features

1. **More Eras**:
   - Greco-Roman Egypt
   - Ottoman Egypt
   - Belle Époque Cairo

2. **Advanced Customization**:
   - User-selectable clothing
   - Custom text overlay
   - Multiple frame options

3. **Social Sharing**:
   - Direct share to Instagram/Facebook
   - Email delivery
   - SMS with QR code

4. **Offline Mode**:
   - Cached models for offline face detection
   - Queue generations for later processing

5. **Multi-Language Support**:
   - Arabic, French, German, Chinese
   - Localized era descriptions

6. **Admin Dashboard**:
   - Real-time usage statistics
   - Error monitoring
   - A/B testing for prompts

---

## 📞 Support & Maintenance

### Troubleshooting

**Camera Not Working**:
- Check browser permissions
- Ensure HTTPS connection
- Try different browser

**Face Detection Fails**:
- Check lighting conditions
- Ensure face is clearly visible
- Try uploading image instead

**AI Generation Errors**:
- Verify API key is set
- Check network connection
- Review console logs for details

**Printing Issues**:
- Confirm printer is connected
- Check printer-config.json
- Verify Electron version

---

## 📄 License & Credits

**Project**: Egypt Time Machine
**Author**: Egypt Time Machine Team
**AI Model**: Google Gemini 2.5 Flash Image
**Face Detection**: face-api.js (TensorFlow.js)
**3D Graphics**: Three.js

---

**Last Updated**: March 17, 2026
**Version**: 0.2.0
**Documentation Version**: 1.2
