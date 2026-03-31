#!/bin/bash
cd "$(dirname "$0")"

# Kill any running instance before launching
pkill -f "pixel-terminal" 2>/dev/null
pkill -f "tauri dev" 2>/dev/null
pkill -f "cargo.*pixel" 2>/dev/null
pkill -f "pixel_voice_bridge" 2>/dev/null   # kill zombie bridge processes holding BLE slot
pkill -f "OmiWebhook" 2>/dev/null
sleep 0.5

# Start OmiWebhook (cloud path) in a new terminal tab
osascript <<'EOF'
tell application "Terminal"
  do script "cd ~/Projects/OmiWebhook && ./start.sh"
end tell
EOF

# Start pixel_voice_bridge (Mac mic default) — waits for pixel-terminal ws_bridge (port 9876)
osascript <<'EOF'
tell application "Terminal"
  do script "cd ~/Projects/OmiWebhook && source venv/bin/activate && echo 'Waiting for pixel-terminal (port 9876)...' && while ! nc -z 127.0.0.1 9876 2>/dev/null; do sleep 1; done && echo 'pixel-terminal ready — starting voice bridge (mic)' && python3 pixel_voice_bridge.py"
end tell
EOF

npm run tauri dev
