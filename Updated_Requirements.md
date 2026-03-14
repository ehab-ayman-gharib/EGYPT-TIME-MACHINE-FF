Egypt Time Machine is an AI-powered photobooth transforming user photos into historical Egyptian portraits. The app uses a local FaceFusion 3.3.0 engine for historical transformations while maintaining a native "instant" capture mode for contemporary souvenirs.

✨ Features List
Core Features
Local AI Transformation: Uses FaceFusion 3.3.0 with RetinaFace and GFPGAN 1.4 for high-fidelity historical results.

Snap a Memory (Direct Mode): A zero-AI, zero-detection bypass that captures the user's photo and immediately applies a decorative frame.

Intelligent Face Detection: Powered by face-api.js (SSD MobileNet V1) exclusively for historical era selection.

DNP Printing: Composed at 1800 x 2700 px for DNP DP-QW410 professional printers.

🔄 Application Workflow
1. Detection Phase (Conditional)
Historical Eras: face-api.js analyzes the capture to categorize gender and age.

Snap a Memory: STRICT BYPASS. No detection logic or demographics analysis should be triggered.

2. Processing Phase
Historical Eras: Selects a 9:16 target from the gender-specific subfolder and executes the FaceFusion CLI.

Snap a Memory: STRICT BYPASS. The raw captured image is passed directly to the result state without modification.

3. Generation Command (Historical Only)
python facefusion.py headless-run --execution-providers cuda --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --face-detector-model retinaface --face-detector-score 0.1 --face-landmarker-score 0.1 --face-selector-mode one --source-paths [user_photo] --target-path [template] --output-path [result].

🛡️ The "Snap a Memory" Bypass (Protected Logic)
To maintain the current high-speed performance of the non-AI mode, the following rules must be strictly enforced:

No AI Processing: Do not call any Python or Gemini services.

No Demographic Analysis: Skip face-api.js entirely to save CPU/GPU cycles.

Existing Composition: Keep the current stampService.ts logic as is—the captured photo is simply layered between the background and the era-specific frame.

💻 Technical Implementation Notes for AI Tools
Asset Structure (Template Mapping)
The historical templates must follow this directory structure to allow dynamic selection based on detection results:

Plaintext
public/
├── Backgrounds/     
├── Frames/          
├── Targets/         
│   ├── {EraName}/       # e.g., Old-Kingdom, Coptic, Islamic
│   │   ├── male/        # Male body templates (768x1344)
│   │   └── female/      # Female body templates (768x1344)
└── models/          # face-api.js weights (Not used for Snap a Memory)
IPC Bridge (Electron)
Only trigger execute-face-fusion for historical era.id values.

The target-path is constructed dynamically: Targets/${era}/${gender}/template_01.jpg.

Snap a Memory should transition from CAMERA to RESULT screen in <1 second.