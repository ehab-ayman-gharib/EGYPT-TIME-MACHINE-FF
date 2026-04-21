@echo off
SETLOCAL EnableDelayedExpansion

echo Starting FaceFusion provisioning for Windows...

:: 1. Path Resolution
SET "SCRIPT_DIR=%~dp0"

:: Smart Target Detection: Check for Dev folder first, then Production (Built App) folder
IF EXIST "%SCRIPT_DIR%public\facefusion" (
    SET "TARGET_DIR=%SCRIPT_DIR%public\facefusion"
    echo [Environment] Development detected.
) ELSE IF EXIST "%SCRIPT_DIR%resources\app.asar.unpacked\dist\facefusion" (
    SET "TARGET_DIR=%SCRIPT_DIR%resources\app.asar.unpacked\dist\facefusion"
    echo [Environment] Production (Built App) detected.
) ELSE (
    echo Error: Could not find FaceFusion folder. 
    echo Please place this script in the root of your project or built app.
    exit /b 1
)

:: Move to the target directory
cd /d "%TARGET_DIR%"
echo Moved to target directory: %TARGET_DIR%


:: 2. Conda Detection
:: Try to find conda from common locations or PATH
SET "CONDA_PATH=E:\miniconda3\condabin\conda.bat"

if not exist "!CONDA_PATH!" (
    where conda >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        for /f "tokens=*" %%i in ('where conda') do set "CONDA_PATH=%%i"
    ) else (
        echo Error: Conda not found at E:\miniconda3 or in PATH.
        echo Please install Miniconda or Anaconda and update this script or booth-config.json.
        exit /b 1
    )
)

echo Using Conda at: !CONDA_PATH!

:: 3. Update booth-config.json with the detected path (using PowerShell for JSON handling)
echo Updating booth-config.json with detected path...
SET "CONFIG_FILE=%SCRIPT_DIR%booth-config.json"
if exist "!CONFIG_FILE!" (
    powershell -Command "$config = Get-Content '!CONFIG_FILE!' | ConvertFrom-Json; $config.win32.condaPath = '!CONDA_PATH!'.Replace('\', '/'); $config | ConvertTo-Json | Set-Content '!CONFIG_FILE!'"
    if %ERRORLEVEL% EQU 0 (
        echo Successfully updated booth-config.json
    ) else (
        echo Warning: Failed to update booth-config.json automatically.
    )
)

:: 4. Conda Environment Setup
SET "ENV_NAME=facefusion"

echo Checking for existing conda environment: !ENV_NAME!...
call "!CONDA_PATH!" env list | findstr /C:"!ENV_NAME!" >nul
if %ERRORLEVEL% EQU 0 (
    echo Environment !ENV_NAME! already exists. Updating...
) else (
    echo Creating environment !ENV_NAME! with Python 3.10...
    call "!CONDA_PATH!" create -n !ENV_NAME! python=3.10 -y
)

:: 4. Activate and Install Dependencies
echo Activating environment !ENV_NAME!...
:: We need to use the full path to activate.bat usually
for %%i in ("!CONDA_PATH!\..\..") do set "CONDA_ROOT=%%~fi"
SET "ACTIVATE_BAT=!CONDA_ROOT!\Scripts\activate.bat"

if not exist "!ACTIVATE_BAT!" (
    :: Try another common location for activate.bat
    SET "ACTIVATE_BAT=!CONDA_ROOT!\condabin\activate.bat"
)

echo Calling activate: !ACTIVATE_BAT!
call "!ACTIVATE_BAT!" !ENV_NAME!

echo Updating pip...
python -m pip install --upgrade pip setuptools wheel

echo Installing Python dependencies from requirements.txt...
if exist "requirements.txt" (
    python -m pip install -r requirements.txt
) else (
    echo Warning: requirements.txt not found in %TARGET_DIR%
)

echo Running FaceFusion install.py with CUDA optimization...
if exist "install.py" (
    :: On Windows we usually want CUDA if available
    python install.py --onnxruntime cuda --skip-conda
) else (
    echo Warning: install.py not found in %TARGET_DIR%
)

:: 5. Verification
echo Verifying FaceFusion installation...
if exist "facefusion.py" (
    python facefusion.py -v
) else (
    echo Warning: facefusion.py not found in %TARGET_DIR%
)

echo ============================================================
echo FaceFusion provisioned successfully on Windows.
echo Environment Name: !ENV_NAME!
echo Conda Path: !CONDA_PATH!
echo ============================================================

ENDLOCAL
pause
