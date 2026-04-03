#!/bin/bash
cd "$(dirname "$0")"
MY_PID=$$

# Kill any running instance before launching (exclude this script's own process tree)
pgrep -f "target/.*/pixel-terminal" | grep -v "$MY_PID" | xargs kill 2>/dev/null
pgrep -f "tauri dev" | grep -v "$MY_PID" | xargs kill 2>/dev/null
pgrep -f "cargo.*pixel" | grep -v "$MY_PID" | xargs kill 2>/dev/null
pkill -f "pixel_voice_bridge" 2>/dev/null   # kill zombie bridge processes holding BLE slot
pkill -f "OmiWebhook" 2>/dev/null
sleep 0.5

# Close ALL Terminal windows/tabs from previous pixel-terminal launches.
# Matches by process name (running) OR tab history/title (dead shells).
osascript <<'CLOSE'
tell application "Terminal"
  set windowCount to count of windows
  repeat with w from windowCount to 1 by -1
    try
      set tabCount to count of tabs of window w
      repeat with t from tabCount to 1 by -1
        try
          set tabProcs to (processes of tab t of window w) as text
          set tabHist to (history of tab t of window w) as text
          if tabProcs contains "OmiWebhook" or tabProcs contains "pixel_voice_bridge" or tabProcs contains "start.sh" or tabProcs contains "tauri" or tabProcs contains "cargo" or tabHist contains "pixel_voice_bridge" or tabHist contains "OmiWebhook" or tabHist contains "tauri dev" or tabHist contains "pixel-terminal" then
            close tab t of window w
          end if
        end try
      end repeat
      -- If window has no tabs left, close it
      if (count of tabs of window w) = 0 then close window w
    end try
  end repeat
end tell
CLOSE
sleep 0.2

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

# Print JS fingerprint so we can confirm new code is loaded
JS_HASH=$(cat src/companion.js src/voice.js src/session-lifecycle.js src/index.html src/styles.css | shasum -a 256 | cut -c1-8)
echo "┌─────────────────────────────────────┐"
echo "│ pixel-terminal launching            │"
echo "│ JS fingerprint: $JS_HASH            │"
echo "└─────────────────────────────────────┘"

# Open a dedicated log tail window
LOG_FILE="/tmp/pixel-terminal.log"
: > "$LOG_FILE"   # truncate on each launch
osascript <<EOF
tell application "Terminal"
  do script "echo '── pixel-terminal log ──' && tail -f $LOG_FILE"
end tell
EOF

npm run tauri dev 2>&1 | tee "$LOG_FILE"
