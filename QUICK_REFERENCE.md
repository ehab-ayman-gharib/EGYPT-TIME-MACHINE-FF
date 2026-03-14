# Egypt Time Machine - Quick Reference

## 🎯 What is This Project?

An AI-powered photobooth that transforms user photos into historical Egyptian portraits across 5 different eras using Google Gemini AI.

---

## 📱 Core Features

| Feature | Description |
|---------|-------------|
| **5 Historical Eras** | Old Kingdom, Coptic, Islamic, Modern Egypt, Snap a Memory |
| **AI Transformation** | Gemini 2.5 Flash Image generates historically accurate portraits |
| **Face Detection** | TensorFlow.js detects gender/age for appropriate clothing |
| **Printing** | Direct integration with Canon SELPHY CP printers |
| **QR Sharing** | Upload and generate QR codes for mobile sharing |
| **Offline Capable** | PWA with service worker caching |

---

## 🗂️ File Quick Reference

### Main Files
- **`App.tsx`** - Main app logic, screen navigation, state management
- **`constants.ts`** - All era configurations, scenery, clothing options
- **`types.ts`** - TypeScript type definitions

### Components
- **`SplashScreen.tsx`** - Landing page with 3D background and era selection
- **`CameraCapture.tsx`** - Camera interface with face detection
- **`ResultScreen.tsx`** - Final image display with download/print/share
- **`LoadingScreen.tsx`** - Processing overlay

### Services
- **`geminiService.ts`** - AI image generation with Gemini API
- **`faceService.ts`** - Face detection using TensorFlow.js
- **`stampService.ts`** - Image composition (background + photo + frame)

### Configuration
- **`vite.config.ts`** - Build configuration, PWA settings
- **`package.json`** - Dependencies and build scripts
- **`electron/main.cjs`** - Electron main process, printer integration

---

## 🔄 User Flow

```
Splash Screen → Select Era → Camera Capture → Face Detection 
→ AI Generation → Image Composition → Result Screen 
→ Download/Print/Share
```

---

## 🎨 Era Breakdown

| Era | Scenes | Clothing Options | Special Features |
|-----|--------|------------------|------------------|
| **Old Kingdom** | 8 | 3 male + 3 female per scene | Dedicated background |
| **Coptic** | 6 | 3 male + 3 female per scene | Church/monastery settings |
| **Islamic** | 4 | 3 male + 3 female per scene | Mosque architecture |
| **Modern** | 3 | Simple descriptions | Contemporary scenarios |
| **Snap a Memory** | 0 | N/A | No AI, just frame |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 19, TypeScript 5.8 |
| **AI/ML** | Google Gemini API, TensorFlow.js, face-api.js |
| **3D Graphics** | Three.js |
| **Build** | Vite 6.2 |
| **Desktop** | Electron 39 |
| **Styling** | TailwindCSS |

---

## 🚀 Quick Start

```bash
# Install
npm install

# Configure
# Create .env.local with:
GEMINI_API_KEY=your_key_here

# Run Dev
npm run dev

# Build Web
npm run build

# Build Electron
npm run electron:build
```

---

## 📊 Key Metrics

- **Canvas Size**: 1080 x 1920 px (portrait)
- **Photo Layer**: 75% of canvas
- **Frame Layer**: 92% of canvas
- **AI Model**: Gemini 2.5 Flash Image
- **Face Detection**: SSD MobileNet V1
- **Max Retries**: 3 attempts
- **Print Size**: 100mm x 148mm (4x6")

---

## 🔌 External APIs

1. **Google Gemini** - Image generation
2. **QR Upload API** - `qr-web-api.vercel.app/upload`
3. **Analytics Dashboard** - `ai-photobooth-dashboard.vercel.app`

---

## 📁 Asset Structure

```
public/
├── Backgrounds/          # Era-specific backgrounds
├── Frames/              # Decorative frames per era
├── Stamps/              # Decorative stamps (legacy)
├── Logos/               # Branding assets
├── models/              # TensorFlow.js models
└── [era]-Preview.png    # Era selection previews
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Camera not working | Check HTTPS, browser permissions |
| Face detection fails | Improve lighting, face visibility |
| AI generation errors | Verify API key, network connection |
| Printing not working | Electron only, check printer config |

---

## 📝 Important Notes

- **Identity Preservation**: AI tries to maintain facial features
- **Anti-Repetition**: Scenery selection avoids consecutive repeats
- **Safety Settings**: All set to BLOCK_NONE for historical content
- **Fallback**: Defaults to female if gender detection fails
- **Child Detection**: Age < 15 classified as child

---

## 🔒 Security

- User photos processed client-side
- API key exposed in client bundle (consider backend proxy)
- QR upload is optional
- No PII collected in analytics

---

## 📞 Quick Troubleshooting

**Check Console Logs**:
- `[Processing]` - AI generation status
- `[Prompt Gen]` - Selected scene and clothing
- `[Composition]` - Image layering process
- `[Dashboard]` - Analytics tracking

**Common Errors**:
- `API_KEY not found` - Set in .env.local
- `No faces detected` - Improve photo quality
- `No image generated` - Check Gemini API status
- `Failed to load models` - Check network, model files

---

For detailed documentation, see **PROJECT_DOCUMENTATION.md**
