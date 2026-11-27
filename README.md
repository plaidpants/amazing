<img width="1717" height="1174" alt="image" src="https://github.com/user-attachments/assets/9b3e831f-24c3-4ed3-8f75-392e3240e2d7" />

Simple reverse engineering experiment using Google Gemini Argon 4 starting with just a 68K Macintosh disk image with the original Amazing maze application by Steve Capps. I've tried this experiment before with various degrees of progress with various AI systems but this is the first time I would call it a success.

https://plaidpants.github.io/amazing/amazing_1984_macintosh_port.html

https://en.wikipedia.org/wiki/Steve_Capps

There is a 3D version available here

https://github.com/plaidpants/Amazing3D

## Contents

- `amazing_1984_macintosh_port.html` — Self-contained 1-bit Macintosh web port with 4 difficulty levels (flat wide paths, 90° overpasses, upper narrow walkways, and diagonal ramps).
- `AmazingAndroid/` — Standalone Android WebView app (`Amazing2D`) featuring full-screen edge-swipe menus, landscape/portrait orientation support, and optional step haptics.
- `Macintosh 68K Assembly Decompilation.pdf` — Decompilation notes from the original 1984 `APPL/MAZE` binary.

## Gameplay & Rendering Highlights

- **Difficulty & Maze Generation**: Level 4 (`Hard`) is tuned for deeper multi-layer weaves (`rampChance: 0.24`, `bridgeChance: 0.92`), and Start/End placement uses BFS shortest-path move distance so solutions always require a meaningful number of moves.
- **Crisp 1-Bit Scaling & Dragging**: Canvas sizing locks to exact integer physical device-pixel multiples to prevent checkerboard Moiré patterns, and 1-step-ahead BFS dragging glides smoothly around corners.
- **Layer-Aware Solution Overlay**: Draws `2×2` dots on wide lower paths and `1×2` / `2×1` ticks on narrow upper paths starting from the last correct point on your current path, occluded cleanly beneath overpasses and dismissed as soon as you click the map.
- **Timer, Statistics & Victory Penguin**: Tracks per-level solves, best times, and averages (excluding runs where Solution was used), pauses automatically when switching tabs/apps, and includes a Trophy statistics dialog with reset confirmation plus a tap-to-toggle 1984 victory penguin overlay.

## Building the Android APK

APKs are ignored by `.gitignore` and distributed via GitHub Releases. To build locally with the Android SDK / OpenJDK paths configured in `AmazingAndroid/build_apk.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File .\AmazingAndroid\build_apk.ps1
```
