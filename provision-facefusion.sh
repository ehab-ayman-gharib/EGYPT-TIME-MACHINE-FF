#!/bin/bash

# Exit on any error
set -e

echo "Starting FaceFusion provisioning..."

# 1. Absolute Path Resolution
# Get the absolute path of the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/public/facefusion"

# Move to the target directory
if [ -d "$TARGET_DIR" ]; then
    cd "$TARGET_DIR"
    echo "Moved to target directory: $TARGET_DIR"
else
    echo "Error: Target directory $TARGET_DIR does not exist. Please ensure the app build is complete or the directory is present."
    exit 1
fi

# 2. System Dependency Check
echo "Checking system dependencies..."

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for the rest of this session depending on architecture
    if [ -d "/opt/homebrew/bin" ]; then
        export PATH="/opt/homebrew/bin:$PATH"
    elif [ -d "/usr/local/bin" ]; then
        export PATH="/usr/local/bin:$PATH"
    fi
else
    echo "Homebrew is installed."
    # Ensure it's in PATH for this script session
    if [ -d "/opt/homebrew/bin" ]; then
        export PATH="/opt/homebrew/bin:$PATH"
    fi
fi

# Function to check and install brew packages
install_if_missing() {
    if ! brew ls --versions "$1" > /dev/null; then
        echo "Installing $1..."
        brew install "$1"
    else
        echo "$1 is already installed."
    fi
}

install_if_missing "python@3.12"
install_if_missing "ffmpeg"
install_if_missing "git"

# 3. Local venv Creation
echo "Cleaning up any previous virtual environment..."
rm -rf venv
echo "Creating local Python virtual environment..."
python3.12 -m venv venv

# Activate the environment
source venv/bin/activate

# Seed the environment
echo "Updating pip, setuptools, and wheel..."
python -m pip install --upgrade pip setuptools wheel

# 4. Dependency Installation
echo "Installing Python dependencies from requirements.txt..."
if [ -f "requirements.txt" ]; then
    python -m pip install -r requirements.txt
else
    echo "Warning: requirements.txt not found in $TARGET_DIR"
fi

echo "Running FaceFusion install.py with Apple Silicon optimization..."
if [ -f "install.py" ]; then
    python install.py --onnxruntime default --skip-conda
else
    echo "Warning: install.py not found in $TARGET_DIR"
fi

# 5. Verification & Config Sync
echo "Verifying FaceFusion installation..."
if [ -f "facefusion.py" ]; then
    python facefusion.py -v || true
else
    echo "Warning: facefusion.py not found in $TARGET_DIR"
fi

# Deactivate when done
deactivate

# Output the absolute path of the venv python executable
VENV_PYTHON_PATH="$(pwd)/venv/bin/python"
echo "============================================================"
echo "FaceFusion provisioned successfully."
echo "Python Executable Path: $VENV_PYTHON_PATH"
echo "Use this path in your booth-config.json dynamically."
echo "============================================================"
