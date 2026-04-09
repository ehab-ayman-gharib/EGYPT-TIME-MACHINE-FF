# Egypt Time Machine - Technical Requirements

Egypt Time Machine is an AI-powered photobooth transforming user photos into historical Egyptian portraits. The app uses a local FaceFusion 3.3.0 engine for high-fidelity transformations while maintaining a native "instant" capture mode for contemporary souvenirs.

## ✨ Core Features
- **Local AI Transformation**: Uses FaceFusion 3.3.0 with YOLO_FACE and GFPGAN 1.4 for group-aware historical results.
- **Snap a Memory (Direct Mode)**: A zero-AI, zero-detection bypass that captures the user's photo and immediately applies a decorative frame.
- **Intelligent Face Detection**: Powered by face-api.js (SSD MobileNet V1) for demographic analysis and template mapping.
- **DNP Printing**: Composed at 1800 x 2700 px (300+ DPI) for DNP DP-QW410 professional printers.

## 🔄 AI Transformation Workflow (Surgical Tiling)
To ensure perfect group portraits of up to 3 people, the system follows a high-precision multi-pass approach:

1. **Gender-Aware Template Selection (The Smart Scan)**
   - The system lists all templates in the target era folder and shuffles them.
   - It performs an AI analysis on up to **3 candidates** using `face-api.js`.
   - It selects a template **only** if the character gender distribution (e.g., 2M, 1F) exactly matches the current user group.
   - If no match is found after 3 tries, it triggers a **GENDER_MISMATCH_FATAL** error to reset the session safely.

2. **Identity Mapping**
   - User faces are matched to template characters by gender (e.g., female user → female slot) rather than horizontal position.
   - Within the same gender, identities are scrambled to ensure variety in different sessions.

3. **Surgical Isolation**
   - Each face is processed as an individual "tile" rather than a full-image swap.
   - The system extracts the head area from the high-res 4K original, processes it through FaceFusion, and seamlessly composites it back into the historical painting.
   - This eliminates "ghosting" or "double faces" common in multi-person AI swaps.

4. **Generation Command**
   `python facefusion.py headless-run --execution-providers cuda --processors face_swapper face_enhancer --face-swapper-model inswapper_128_fp16 --face-enhancer-model gfpgan_1.4 --face-detector-model yolo_face --face-detector-score 0.15 --face-landmarker-score 0.0 --face-selector-mode one --reference-face-distance 1.0`

## 💻 Asset Structure (Template Mapping)
Templates are organized by person count and gender composition:

```
public/Targets/{EraName}/
├── 1M/          # Single Male
├── 1F/          # Single Female
├── 2M/          # Pair of Males
├── 2F/          # Pair of Females
├── 1M_1F/       # Mixed Pair
├── 3M/          # Triple Males
├── 3F/          # Triple Females
├── 2M_1F/       # Mixed Triple
└── 2F_1M/       # Mixed Triple
```

## 🛡️ The "Snap a Memory" Bypass
- **No AI Processing**: Do not call any Python or FaceFusion services.
- **No Demographic Analysis**: Skip `face-api.js` entirely for this mode.
- **Instant Speed**: Must transition from CAMERA to RESULT in < 1 second.