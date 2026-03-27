#!/bin/bash
cd "$(dirname "$0")"

# Kill any running instance before launching
pkill -f "pixel-terminal" 2>/dev/null
pkill -f "tauri dev" 2>/dev/null
pkill -f "cargo.*pixel" 2>/dev/null
sleep 0.5

npm run tauri dev
