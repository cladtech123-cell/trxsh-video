# Source from the project root: `. tools/env.sh`. Puts a full ffmpeg first on PATH (Remotion's own
# ffmpeg lacks atempo, afade and friends), Remotion's ffprobe after it, and UTF-8 for Python on Windows.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
EXT=""
[ "$OS" = "Windows_NT" ] && EXT=".exe"
if [ ! -f "$ROOT/tools/bin/ffmpeg$EXT" ] && ! ffmpeg -hide_banner -filters 2>/dev/null | grep -q atempo; then
  F=$(python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())" 2>/dev/null)
  if [ -n "$F" ]; then
    mkdir -p "$ROOT/tools/bin" && cp "$F" "$ROOT/tools/bin/ffmpeg$EXT"
  else
    echo "env.sh: no full ffmpeg found: install one, or: pip install imageio-ffmpeg" >&2
  fi
fi
export PATH="$ROOT/tools/bin:$PATH"
for d in "$ROOT"/node_modules/@remotion/compositor-*/; do [ -d "$d" ] && export PATH="$PATH:$d"; done
# Remotion renders with an installed Chrome when it cannot download its own headless shell
if [ -z "$REMOTION_BROWSER" ]; then
  for c in "C:/Program Files/Google/Chrome/Application/chrome.exe" "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" /usr/bin/google-chrome /usr/bin/chromium; do
    [ -f "$c" ] && export REMOTION_BROWSER="$c" && break
  done
fi
