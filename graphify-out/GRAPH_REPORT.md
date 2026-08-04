# Graph Report - EGYPT-TIME-MACHINE-FF  (2026-08-04)

## Corpus Check
- 254 files · ~1,238,148 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2198 nodes · 5154 edges · 134 communities (123 shown, 11 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 231 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b66ed109`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 114|Community 114]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 128|Community 128]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 131|Community 131]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 133|Community 133]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 135|Community 135]]
- [[_COMMUNITY_Community 136|Community 136]]
- [[_COMMUNITY_Community 137|Community 137]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 140|Community 140]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 143|Community 143]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 149|Community 149]]

## God Nodes (most connected - your core abstractions)
1. `get_test_example_file()` - 130 edges
2. `get_test_jobs_directory()` - 73 edges
3. `get_test_output_file()` - 65 edges
4. `get_test_examples_directory()` - 47 edges
5. `is_test_output_file()` - 43 edges
6. `is_video()` - 42 edges
7. `Command` - 39 edges
8. `prepare_test_output_directory()` - 37 edges
9. `is_image()` - 32 edges
10. `ArgumentParser` - 32 edges

## Surprising Connections (you probably didn't know these)
- `SplashScreenProps` --references--> `EraData`  [EXTRACTED]
  components/SplashScreen.tsx → types.ts
- `listen()` --calls--> `get_ui_component()`  [INFERRED]
  facefusion/facefusion/uis/components/age_modifier_options.py → facefusion/facefusion/uis/core.py
- `listen()` --calls--> `get_ui_component()`  [INFERRED]
  facefusion/facefusion/uis/components/background_remover_options.py → facefusion/facefusion/uis/core.py
- `listen()` --calls--> `get_ui_component()`  [INFERRED]
  facefusion/facefusion/uis/components/deep_swapper_options.py → facefusion/facefusion/uis/core.py
- `listen()` --calls--> `get_ui_component()`  [INFERRED]
  facefusion/facefusion/uis/components/expression_restorer_options.py → facefusion/facefusion/uis/core.py

## Import Cycles
- 1-file cycle: `facefusion/facefusion/ffmpeg.py -> facefusion/facefusion/ffmpeg.py`
- 1-file cycle: `facefusion/facefusion/config.py -> facefusion/facefusion/config.py`
- 1-file cycle: `facefusion/facefusion/time_helper.py -> facefusion/facefusion/time_helper.py`
- 1-file cycle: `facefusion/tests/test_time_helper.py -> facefusion/tests/test_time_helper.py`
- 1-file cycle: `facefusion/facefusion/uis/components/terminal.py -> facefusion/facefusion/uis/components/terminal.py`

## Communities (134 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (56): Anchors, collect_model_downloads(), create_static_model_set(), detect_faces(), detect_faces_by_angle(), detect_with_retinaface(), detect_with_scrfd(), detect_with_yolo_face() (+48 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (65): resolve_execution_providers(), render(), ExecutionDevice, apply_args(), balance_source_embedding(), clear_inference_pool(), convert_source_embedding(), create_static_model_set() (+57 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (83): Content, conditional_download_sources(), validate_source_paths(), get_static_faces(), set_static_faces(), Face, VisionFrame, Args (+75 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (21): analyse_frame(), analyse_image(), analyse_stream(), analyse_video(), collect_model_downloads(), create_static_model_set(), detect_nsfw(), detect_with_nsfw_1() (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (61): register_args(), _ArgumentGroup, register_args(), register_args(), register_args(), register_args(), create_float_metavar(), create_int_metavar() (+53 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (43): { ipcRenderer }, CameraCapture(), CameraCaptureProps, CFG, CORNER_COLORS, CORNERS, FeaturedGallery(), { ipcRenderer } (+35 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (57): AudioEncoder, Command, Duration, Fps, StreamMode, VideoEncoder, VideoPreset, capture_video() (+49 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (58): apply_args(), apply_edit(), calculate_distance_ratio(), clear_inference_pool(), create_static_model_set(), edit_eye_gaze(), edit_eye_open(), edit_eyebrow_direction() (+50 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (26): apply(), get_step_choices(), listen(), remote_update(), render(), update(), update_step_index(), listen() (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (42): conditional_download(), has_video(), get_test_example_file(), get_test_examples_directory(), get_test_outputs_directory(), before_all(), test_get_audio_frame(), test_read_static_audio() (+34 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (42): AudioChunk, convert_hertz_to_mel(), convert_mel_to_hertz(), create_mel_filter_bank(), create_spectrogram(), extract_audio_frames(), get_audio_frame(), get_voice_frame() (+34 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (47): detect_app_context(), AppContext, DownloadSet, ExecutionProvider, InferencePool, JobStatus, TableContent, TableHeader (+39 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (41): apply_background_color(), clear_inference_pool(), create_static_model_set(), forward(), get_inference_pool(), get_model_options(), normalize_vision_mask(), post_process() (+33 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (28): get_test_output_file(), is_test_output_file(), test_batch_run_sources_to_targets(), test_batch_run_targets(), test_restore_expression_to_image(), test_restore_expression_to_video(), test_debug_face_to_image(), test_debug_face_to_video() (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (34): pre_process(), pre_process(), render(), remote_update(), render(), pre_process(), pre_process(), pre_process() (+26 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (58): AudioBuffer, AudioEncoder, Command, EncoderSet, Fps, Popen, Resolution, tqdm (+50 more)

### Community 16 - "Community 16"
Cohesion: 0.38
Nodes (5): render(), update(), File, Image, Video

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (34): apply_args(), apply_restore(), clear_inference_pool(), create_static_model_set(), forward_extract_feature(), forward_extract_motion(), forward_generate_frame(), get_inference_pool() (+26 more)

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (23): create_directory(), is_directory(), remove_directory(), clear_jobs(), init_jobs(), prepare_test_output_directory(), before_each(), before_each() (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (23): Component, ComponentName, listen(), listen(), listen(), render(), listen(), remote_update() (+15 more)

### Community 20 - "Community 20"
Cohesion: 0.60
Nodes (4): Resolution, Scale, test_output_image_scale(), test_output_video_scale()

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (13): render(), calculate_int_step(), create_float_range(), create_int_range(), is_linux(), limit_system_memory(), test_calc_float_step(), test_calc_int_step() (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (62): clear_and_update_reference_position_gallery(), extract_gallery_frames(), update_face_selector_age_range(), update_face_selector_gender(), update_face_selector_mode(), update_face_selector_order(), update_face_selector_race(), update_reference_face_position() (+54 more)

### Community 23 - "Community 23"
Cohesion: 0.05
Nodes (69): apply_args(), clear_inference_pool(), create_static_model_set(), forward(), get_inference_pool(), get_model_options(), get_model_size(), has_morph_input() (+61 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (28): ApplyStateItem, Args, AudioFrame, DownloadScope, Face, InferencePool, LipSyncerWeight, ModelOptions (+20 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (23): ApplyStateItem, Args, DownloadScope, InferencePool, ModelOptions, ModelSet, ProcessorOutputs, VisionFrame (+15 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (13): ConfigParser, cast_bool(), cast_float(), cast_int(), get_bool_value(), get_config_parser(), get_float_value(), get_int_list() (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.28
Nodes (13): ErrorCode, detect_video_resolution(), restrict_trim_frame(), restrict_video_fps(), restrict_video_resolution(), is_process_stopping(), extract_frames(), finalize_video() (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (26): listen(), render(), pre_start(), pre_stop(), render(), start(), stop(), update_source() (+18 more)

### Community 30 - "Community 30"
Cohesion: 0.31
Nodes (8): BackgroundRemoverModel, listen(), remote_update(), render(), update_background_remover_color(), update_background_remover_model(), Dropdown, Group

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (18): listen(), remote_update(), render(), update_deep_swapper_model(), listen(), remote_update(), render(), update_face_enhancer_model() (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (7): listen(), remote_update(), render(), update_face_editor_model(), FaceEditorModel, Dropdown, Slider

### Community 33 - "Community 33"
Cohesion: 0.20
Nodes (13): create_faces(), get_average_face(), get_one_face(), scale_face(), estimate_face_angle(), get_nms_threshold(), BoundingBox, Face (+5 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (15): 1. Installation, 2. Production Local Server Architecture, 3. Bypassing Snap API Origin Whitelists, 4. Front-End Core Integration, 5. Matrix Transformations (`Transform2D`) for Rotated Portrait setups, 6. Capturing Photos, Column-Major Matrix Formula, Setup Context (+7 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (12): listen(), update_output_audio_encoder(), update_output_image_scale(), update_output_video_encoder(), update_output_video_fps(), update_output_video_preset(), update_output_video_scale(), AudioEncoder (+4 more)

### Community 36 - "Community 36"
Cohesion: 0.16
Nodes (19): Age, categorize_age(), categorize_gender(), categorize_race(), classify_face(), create_static_model_set(), forward(), get_inference_pool() (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.39
Nodes (6): get_many_faces(), test_get_many_faces(), test_get_one_face_with_retinaface(), test_get_one_face_with_scrfd(), test_get_one_face_with_yoloface(), test_get_one_face_with_yunet()

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (23): apply_args(), clear_inference_pool(), create_static_model_set(), forward(), get_inference_pool(), get_model_options(), modify_age(), normalize_extend_frame() (+15 more)

### Community 44 - "Community 44"
Cohesion: 0.28
Nodes (14): check(), end(), get_process_state(), is_checking(), is_pending(), is_processing(), is_stopping(), set_process_state() (+6 more)

### Community 45 - "Community 45"
Cohesion: 0.09
Nodes (27): BenchmarkCycleSet, listen(), render(), update_preview_frame_slider(), listen(), remote_update(), render(), update_trim_frame() (+19 more)

### Community 46 - "Community 46"
Cohesion: 0.21
Nodes (13): calculate_face_embedding(), create_static_model_set(), forward(), get_inference_pool(), get_model_options(), pre_check(), DownloadScope, Embedding (+5 more)

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (16): JobStatus, get_test_job_file(), get_test_jobs_directory(), is_test_job_file(), test_modify_age_to_image(), test_modify_age_to_video(), before_each(), test_job_add_step() (+8 more)

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (7): render(), update_face_landmarker_model(), update_face_landmarker_score(), calculate_float_step(), Dropdown, Score, FaceLandmarkerModel

### Community 50 - "Community 50"
Cohesion: 0.10
Nodes (19): 📁 Asset Structure, 🐛 Common Issues, Components, Configuration, 📱 Core Features, Egypt Time Machine - Quick Reference, 🎨 Era Breakdown, 🔌 External APIs (+11 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (5): render(), render(), update_video_memory_strategy(), CheckboxGroup, VideoMemoryStrategy

### Community 53 - "Community 53"
Cohesion: 0.24
Nodes (10): listen(), remote_update(), render(), update_expression_restorer_areas(), update_expression_restorer_model(), ExpressionRestorerArea, ExpressionRestorerModel, CheckboxGroup (+2 more)

### Community 54 - "Community 54"
Cohesion: 0.26
Nodes (10): has_face_swapper_weight(), listen(), remote_update(), render(), update_face_swapper_model(), update_face_swapper_weight(), Dropdown, Slider (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (12): pre_check(), get_static_download_size(), open_curl(), ping_static_url(), resolve_download_url(), resolve_download_url_by_provider(), Command, DownloadProvider (+4 more)

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (17): Current Limitations, Data Handling, Egypt Time Machine - Project Documentation, ✨ Features List, 📝 Future Enhancements, 🐛 Known Issues & Limitations, 📄 License & Credits, Optimization Strategies (+9 more)

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (11): LogLevel, create_message(), debug(), disable(), enable(), error(), get_package_logger(), info() (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.05
Nodes (69): apply_args(), Color, update_download_providers(), update_execution_providers(), clear(), create_and_run_job(), listen(), remote_update() (+61 more)

### Community 59 - "Community 59"
Cohesion: 0.16
Nodes (27): Distance, apply_nms(), calculate_paste_area(), convert_to_face_landmark_5(), create_bounding_box(), distance_to_bounding_box(), distance_to_face_landmark_5(), estimate_matrix_by_face_landmark_5() (+19 more)

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (5): BenchmarkMode, BenchmarkResolution, render(), update_benchmark_mode(), update_benchmark_resolutions()

### Community 61 - "Community 61"
Cohesion: 0.13
Nodes (13): 1. Image Composition (Renderer), 2. Windows Printer Preferences (Manual), 3. Native Print Engine (Main Process), 4. Troubleshooting, Implementation in `electron/main.cjs`:, Professional Borderless Photo Printing Workflow, 1. Setup the Printer Selection Logic (Renderer Process), 2. Implement the Print Handler (Main Process) (+5 more)

### Community 62 - "Community 62"
Cohesion: 0.35
Nodes (9): chain(), download(), ping(), run(), set_retry(), set_timeout(), Command, test_chain() (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.27
Nodes (7): listen(), remote_update(), render(), update_frame_colorizer_model(), Dropdown, Slider, FrameColorizerModel

### Community 65 - "Community 65"
Cohesion: 0.27
Nodes (9): listen(), remote_update(), render(), update_lip_syncer_model(), update_lip_syncer_weight(), Dropdown, LipSyncerWeight, Slider (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.31
Nodes (7): AgeModifierModel, listen(), remote_update(), render(), update_age_modifier_model(), Dropdown, Slider

### Community 68 - "Community 68"
Cohesion: 0.31
Nodes (7): listen(), remote_update(), render(), update_frame_enhancer_model(), Dropdown, Slider, FrameEnhancerModel

### Community 69 - "Community 69"
Cohesion: 0.31
Nodes (5): create_tqdm_output(), tqdm_update(), update_log_level(), LogLevel, tqdm

### Community 70 - "Community 70"
Cohesion: 0.14
Nodes (14): 10. **User Experience Enhancements**, 1. **Multi-Era Historical Transformation**, 2. **Intelligent Face Detection**, 3. **AI Image Generation**, 4. **Local FaceFusion Transformation (High-Fidelity)**, 5. **Camera & Upload Capabilities**, 5. **Orchestrator Logic: Surgical Tiling (Multi-Face Precision)**, 6. **FaceFusion Tuning Parameters** (+6 more)

### Community 71 - "Community 71"
Cohesion: 0.15
Nodes (13): Components, `components/CameraCapture.tsx`, `components/LoadingScreen.tsx`, `components/ResultScreen.tsx`, `components/SplashScreen.tsx`, Configuration Files, `.env.local`, 📁 File Structure & Functionality (+5 more)

### Community 72 - "Community 72"
Cohesion: 0.33
Nodes (6): listen(), remote_update(), render(), update_temp_frame_format(), Dropdown, TempFrameFormat

### Community 73 - "Community 73"
Cohesion: 0.14
Nodes (29): ColorMode, clear_and_update_preview_image(), create_face_by_face(), extract_crop_frame(), prepare_output_frame(), process_preview_frame(), render(), update_preview_image() (+21 more)

### Community 74 - "Community 74"
Cohesion: 0.29
Nodes (7): DNP Printing, Egypt Time Machine, face-api.js, FaceFusion 3.3.0, GFPGAN 1.4, python facefusion.py, YOLO_FACE

### Community 75 - "Community 75"
Cohesion: 0.40
Nodes (5): listen(), render(), update_job_dataframe(), Dataframe, JobStatus

### Community 78 - "Community 78"
Cohesion: 0.40
Nodes (3): Blocks, render(), run()

### Community 79 - "Community 79"
Cohesion: 0.40
Nodes (3): Blocks, render(), run()

### Community 80 - "Community 80"
Cohesion: 0.40
Nodes (3): Blocks, render(), run()

### Community 81 - "Community 81"
Cohesion: 0.40
Nodes (3): Blocks, render(), run()

### Community 84 - "Community 84"
Cohesion: 0.60
Nodes (4): __autoload__(), get(), load(), Locales

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (6): listen(), remote_update(), render(), update_face_debugger_items(), FaceDebuggerItem, CheckboxGroup

### Community 90 - "Community 90"
Cohesion: 0.14
Nodes (29): create_rotation_matrix_and_size(), warp_face_by_translation(), collect_model_downloads(), conditional_optimize_contrast(), create_static_model_set(), detect_face_landmark(), detect_with_2dfan4(), detect_with_peppa_wutz() (+21 more)

### Community 92 - "Community 92"
Cohesion: 0.22
Nodes (8): 1. Prerequisites & Installation, 2. Vite Configuration, 3. Electron Main Script, 4. Package.json Configuration, 5. Asset Path Enforcement (CRITICAL), 6. Building the App, Electron Windows Build Workflow, Troubleshooting

### Community 93 - "Community 93"
Cohesion: 0.25
Nodes (8): `detectFaces(videoElement, isLoaded)`, `generateHistoricalImage(base64Image, era, faceData)`, `incrementGeneratedCount()`, `loadFaceApiModels()`, Services, `services/faceService.ts`, `services/geminiService.ts`, `services/stampService.ts`

### Community 96 - "Community 96"
Cohesion: 0.29
Nodes (6): 1. Prerequisites, 2. Configuration Check, 3. Build Command, 4. Output, 5. Troubleshooting, Electron Mac Build Workflow

### Community 102 - "Community 102"
Cohesion: 0.29
Nodes (6): 1. Cloudinary Setup, 2. Electron Main Process (`main.cjs`), 3. React Implementation (`App.tsx`), 4. Troubleshooting: ENOENT Errors, 5. Summary of Benefits, Cloudinary Differential Sync Workflow

### Community 103 - "Community 103"
Cohesion: 0.29
Nodes (6): 1. Image Composition (Renderer), 2. macOS Printer Preferences (Manual), 3. Native Print Engine (Main Process), 4. Troubleshooting, Implementation in `electron/main.cjs`:, Professional Borderless Photo Printing Workflow (macOS)

### Community 114 - "Community 114"
Cohesion: 0.40
Nodes (4): render(), update_job_status_checkbox_group(), CheckboxGroup, JobStatus

### Community 130 - "Community 130"
Cohesion: 0.33
Nodes (6): `booth-config.json`, `createWindow()`, Electron Files, `electron/main.cjs`, `getPrinterConfig()`, IPC Handlers:

### Community 131 - "Community 131"
Cohesion: 0.33
Nodes (6): Coptic Egypt, 🎨 Era Configurations, Islamic Golden Age, Modern Egypt, Old Kingdom Egypt, Snap a Memory

### Community 132 - "Community 132"
Cohesion: 0.33
Nodes (5): 🔄 AI Transformation Workflow (Surgical Tiling), 💻 Asset Structure (Template Mapping), ✨ Core Features, Egypt Time Machine - Technical Requirements, 🛡️ The "Snap a Memory" Bypass

### Community 133 - "Community 133"
Cohesion: 0.40
Nodes (5): 1. Google Gemini API, 2. Local FaceFusion Integration, 3. Analytics Dashboard API, 3. QR Code Upload API, 🔌 API Integrations

### Community 134 - "Community 134"
Cohesion: 0.40
Nodes (5): 🚀 Build & Deployment, Deployment Checklist, Development, Electron Packaging Notes, Production Build

### Community 135 - "Community 135"
Cohesion: 0.40
Nodes (4): 1. Use String Literals for Safety Settings, 2. Configuration Logic, 3. Prompt Softening, Gemini Safety Settings Configuration

### Community 136 - "Community 136"
Cohesion: 0.50
Nodes (4): 🏗️ Architecture, Component Architecture, Service Layer, Technology Stack

### Community 137 - "Community 137"
Cohesion: 0.33
Nodes (6): `App.tsx`, `constants.ts`, `index.html`, `index.tsx`, Root Files, `types.ts`

### Community 139 - "Community 139"
Cohesion: 0.67
Nodes (3): 🔄 Application Workflow, State Management Flow, User Journey Flow

### Community 141 - "Community 141"
Cohesion: 0.70
Nodes (4): create_table_parts(), render_table(), TableContent, TableHeader

### Community 142 - "Community 142"
Cohesion: 0.20
Nodes (9): render(), update_face_detector_angles(), update_face_detector_model(), update_face_detector_score(), Angle, CheckboxGroup, Dropdown, FaceDetectorModel (+1 more)

### Community 145 - "Community 145"
Cohesion: 0.08
Nodes (48): is_windows(), Resolution, Scale, Size, VisionFrame, ErrorCode, blend_frame(), blend_vision_frames() (+40 more)

### Community 149 - "Community 149"
Cohesion: 0.36
Nodes (6): render(), update(), Audio, File, Image, has_audio()

## Knowledge Gaps
- **462 isolated node(s):** `{ ipcRenderer }`, `{ ipcRenderer }`, `CFG`, `Phase`, `radialGlowTexture` (+457 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `is_video()` connect `Community 14` to `Community 2`, `Community 72`, `Community 73`, `Community 9`, `Community 45`, `Community 15`, `Community 16`, `Community 145`, `Community 19`, `Community 22`, `Community 58`, `Community 28`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `get_test_example_file()` connect `Community 9` to `Community 2`, `Community 37`, `Community 38`, `Community 73`, `Community 10`, `Community 13`, `Community 45`, `Community 15`, `Community 48`, `Community 145`, `Community 18`, `Community 20`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `register_ui_component()` connect `Community 19` to `Community 12`, `Community 142`, `Community 14`, `Community 16`, `Community 149`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 45`, `Community 49`, `Community 53`, `Community 54`, `Community 58`, `Community 64`, `Community 65`, `Community 67`, `Community 68`, `Community 73`, `Community 88`, `Community 114`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `{ ipcRenderer }`, `{ ipcRenderer }`, `CFG` to the rest of the system?**
  _462 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08299240210403273 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05242566510172144 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.058050645007166744 - nodes in this community are weakly interconnected._