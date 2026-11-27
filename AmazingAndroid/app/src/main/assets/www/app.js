/* ============================================================================
 * Amazing 2D (Android) - UI & interaction layer around the 1984 web-port engine
 * Matches the 3D in-game Macintosh wrist map from AmazingMazeBuilder3D.cs:
 *   - Unified Macintosh window: Top Stats Bar + 1-Bit Maze + Bottom Controls Bar
 *   - Always fits the whole maze on the Android screen (no scrolling or rotation)
 *   - Drag a finger from the player along the corridors (no D-pad)
 *   - Easy..Hard primitive circle radio buttons; regenerates only on "New Game"
 *   - Temporary 8s dotted/dashed 1-bit solution overlay from Player to Goal
 *   - Timer + per-skill solves & best time persisted in localStorage
 *   - 1984 Macintosh Penguin overlay + bugle fanfare + 1-bit fireworks on solve
 * ============================================================================ */
'use strict';

const macWindow = document.getElementById('macWindow');
const fxCanvas = document.getElementById('fxCanvas');
const fxCtx = fxCanvas.getContext('2d');
const mazeFrame = document.getElementById('mazeFrame');
const statsPanel = document.getElementById('statsPanel');
const statsText = document.getElementById('statsText');
const controlsPanel = document.getElementById('controlsPanel');
const btnNew = document.getElementById('btnNew');
const btnSolution = document.getElementById('btnSolution');

const TOP_BAR_LOGICAL_H = 34;
const BOT_BAR_LOGICAL_H = 42;
const SOLUTION_DISPLAY_SECONDS = 8.0;
const STORAGE_PREFIX = 'amazing2d_';

let pendingSkill = clampInt(parseInt(localStorage.getItem(STORAGE_PREFIX + 'pendingSkill') || '0', 10), 0, 3);
let hapticsEnabled = localStorage.getItem(STORAGE_PREFIX + 'haptics') !== '0';
let activeSolutionNodes = [];
let solutionTimer = null;
let showPenguin = false;
let solutionUsedThisMaze = false;

/* ---------------------------------------------------------------- utilities */
function clampInt(v, lo, hi) {
    if (isNaN(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
}

function fmtTime(sec) {
    if (!(sec > 0)) return '00:00';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function fmtStatTime(sec) {
    return (sec > 0) ? fmtTime(sec) : '--:--';
}

/* -------------------------------------------------------------- stats store */
function getSolves(lvl) {
    return parseInt(localStorage.getItem(STORAGE_PREFIX + 'solves_L' + lvl) || '0', 10) || 0;
}

function getBest(lvl) {
    return parseFloat(localStorage.getItem(STORAGE_PREFIX + 'best_L' + lvl) || '0') || 0;
}

function getTotalTime(lvl) {
    return parseFloat(localStorage.getItem(STORAGE_PREFIX + 'total_L' + lvl) || '0') || 0;
}

function getTimedSolves(lvl) {
    return parseInt(localStorage.getItem(STORAGE_PREFIX + 'timed_L' + lvl) || '0', 10) || 0;
}

function getAverage(lvl) {
    const timed = getTimedSolves(lvl);
    const total = getTotalTime(lvl);
    if (timed > 0 && total > 0) return total / timed;
    const solves = getSolves(lvl);
    const best = getBest(lvl);
    if (solves === 1 && best > 0) return best;
    return 0;
}

function recordSolve(lvl, seconds) {
    localStorage.setItem(STORAGE_PREFIX + 'solves_L' + lvl, String(getSolves(lvl) + 1));
    const best = getBest(lvl);
    if (best <= 0.01 || seconds < best) {
        localStorage.setItem(STORAGE_PREFIX + 'best_L' + lvl, String(seconds));
    }
    if (seconds > 0) {
        localStorage.setItem(STORAGE_PREFIX + 'total_L' + lvl, String(getTotalTime(lvl) + seconds));
        localStorage.setItem(STORAGE_PREFIX + 'timed_L' + lvl, String(getTimedSolves(lvl) + 1));
    }
}

function clearAllStats() {
    for (let lvl = 0; lvl < 4; lvl++) {
        localStorage.removeItem(STORAGE_PREFIX + 'solves_L' + lvl);
        localStorage.removeItem(STORAGE_PREFIX + 'best_L' + lvl);
        localStorage.removeItem(STORAGE_PREFIX + 'total_L' + lvl);
        localStorage.removeItem(STORAGE_PREFIX + 'timed_L' + lvl);
    }
}

/* -------------------------------------------------------------------- timer */
const timer = { accum: 0, start: 0, running: false, paused: false };

function timerReset() {
    timer.accum = 0;
    timer.start = performance.now();
    timer.running = true;
    timer.paused = document.hidden;
}

function timerElapsed() {
    let t = timer.accum;
    if (timer.running && !timer.paused) t += (performance.now() - timer.start) / 1000;
    return t;
}

function timerStop() {
    timer.accum = timerElapsed();
    timer.running = false;
}

function pauseGameTimer() {
    if (!timer.running || timer.paused) return;
    timer.accum += (performance.now() - timer.start) / 1000;
    timer.paused = true;
}

function resumeGameTimer(bgMs) {
    if (!timer.running) return;
    if (timer.paused) {
        timer.start = performance.now();
        timer.paused = false;
    } else if (bgMs > 0) {
        timer.start = Math.min(performance.now(), timer.start + bgMs);
    }
    updateStatsUI();
}

window.onAppPause = function () {
    pauseGameTimer();
    try {
        if (actx && actx.state === 'running') actx.suspend();
    } catch (_) { /* ignore */ }
};

window.onAppResume = function (bgMs) {
    resumeGameTimer(bgMs || 0);
    try {
        if (actx && actx.state === 'suspended') actx.resume();
    } catch (_) { /* ignore */ }
};

document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGameTimer();
    else resumeGameTimer(0);
});

/* ------------------------------------------------------------- stats header */
function updateStatsUI() {
    const lvl = clampInt(pendingSkill, 0, 3);
    const solves = getSolves(lvl);
    const best = fmtStatTime(getBest(lvl));
    const cur = fmtTime(timerElapsed());
    const rot = ((deviceRelDeg % 360) + 360) % 360;
    const isPortrait = (rot === 90 || rot === 270);

    if (gGameWon) {
        const prefix = solutionUsedThisMaze ? 'Solved (w/ Sol)' : 'Solved!';
        statsText.textContent = isPortrait
            ? `${prefix}  Time: ${cur}\nSolves: ${solves}   Best: ${best}`
            : `${prefix}  Time: ${cur}   Solves: ${solves}   Best: ${best}`;
    } else {
        statsText.textContent = isPortrait
            ? `Time: ${cur}   Lv.${lvl + 1}\nSolves: ${solves}   Best: ${best}`
            : `Time: ${cur}    Lv.${lvl + 1} Solves: ${solves}    Best: ${best}`;
    }
    statsPanel.classList.toggle('solved', !!gGameWon);
}

setInterval(() => {
    if (timer.running) updateStatsUI();
}, 250);

/* --------------------------------------- shortest-path dotted solution line */
function findShortestPathToEnd() {
    if (!gStartPos || !gEndPos) return [];
    const startKey = `${gStartPos.r},${gStartPos.c},${gStartPos.layer}`;
    const visited = new Set([startKey]);
    const parent = new Map();
    const queue = [{ r: gStartPos.r, c: gStartPos.c, layer: gStartPos.layer }];
    let found = null;

    while (queue.length > 0) {
        const cur = queue.shift();
        if (cur.r === gEndPos.r && cur.c === gEndPos.c && cur.layer === gEndPos.layer) {
            found = cur;
            break;
        }
        for (let dir = 0; dir < 4; dir++) {
            const step = canMove(cur.r, cur.c, cur.layer, dir);
            if (!step) continue;
            const nextNode = { r: step.r, c: step.c, layer: step.layer };
            const nextKey = `${nextNode.r},${nextNode.c},${nextNode.layer}`;
            if (!visited.has(nextKey)) {
                visited.add(nextKey);
                parent.set(nextKey, cur);
                queue.push(nextNode);
            }
        }
    }

    if (!found) return [];
    const fullSolution = [];
    let trace = found;
    while (trace) {
        fullSolution.push(trace);
        const key = `${trace.r},${trace.c},${trace.layer}`;
        if (key === startKey) break;
        trace = parent.get(key);
    }
    fullSolution.reverse();

    if (gPathHistory && gPathHistory.length > 0) {
        const solIndexMap = new Map();
        for (let i = 0; i < fullSolution.length; i++) {
            const n = fullSolution[i];
            solIndexMap.set(`${n.r},${n.c},${n.layer}`, i);
        }
        for (let k = gPathHistory.length - 1; k >= 0; k--) {
            const p = gPathHistory[k];
            const idx = solIndexMap.get(`${p.r},${p.c},${p.layer}`);
            if (idx !== undefined) return fullSolution.slice(idx);
        }
    }
    return fullSolution;
}

const solutionDotsByCellLayer = new Map();

function buildSolutionDotsMap() {
    solutionDotsByCellLayer.clear();
    if (!gShowingSolution || !activeSolutionNodes || activeSolutionNodes.length < 2) return;

    for (let i = 0; i < activeSolutionNodes.length - 1; i++) {
        const a = activeSolutionNodes[i];
        const b = activeSolutionNodes[i + 1];

        let dir = -1;
        if (b.c === a.c - 1) dir = DIR_LEFT;
        else if (b.r === a.r + 1) dir = DIR_DOWN;
        else if (b.c === a.c + 1) dir = DIR_RIGHT;
        else if (b.r === a.r - 1) dir = DIR_UP;

        let outLayer = a.layer;
        let inLayer = b.layer;
        if (dir !== -1) {
            const stepInfo = canMove(a.r, a.c, a.layer, dir);
            if (stepInfo) {
                const otherBase = (baseLayerOfPlane(a.layer) === LAYER_WIDE_BASE) ? LAYER_NARROW_BASE : LAYER_WIDE_BASE;
                outLayer = MemberOf(dir, a.r, a.c, a.layer) ? a.layer : otherBase;
                inLayer = stepInfo.entryLayer;
            }
        }

        const ax = MARGIN_X + (a.c - 1) * TILE_STRIDE + 7;
        const ay = MARGIN_Y + (a.r - 1) * TILE_STRIDE + 7;
        const bx = MARGIN_X + (b.c - 1) * TILE_STRIDE + 7;
        const by = MARGIN_Y + (b.r - 1) * TILE_STRIDE + 7;
        const isHorizontal = (by === ay);
        const prev = i > 0 ? activeSolutionNodes[i - 1] : null;
        const isCornerStart = prev && ((prev.r === a.r) !== (a.r === b.r));

        const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        for (let s = 0; s <= steps; s++) {
            const firstHalf = s < steps / 2;
            const segLayer = firstHalf ? outLayer : inLayer;
            const isWide = isWideSubLayer(segLayer);

            if (isWide) {
                if ((s & 2) !== 0) continue;
            } else {
                if ((s & 1) !== 0) continue;
            }

            const px = steps === 0 ? ax : Math.trunc(ax + (bx - ax) * s / steps);
            const py = steps === 0 ? ay : Math.trunc(ay + (by - ay) * s / steps);
            const dw = (isWide || (s === 0 && isCornerStart) || !isHorizontal) ? 2 : 1;
            const dh = (isWide || (s === 0 && isCornerStart) || isHorizontal) ? 2 : 1;
            const key = firstHalf ? `${a.r},${a.c},${outLayer}` : `${b.r},${b.c},${inLayer}`;
            let list = solutionDotsByCellLayer.get(key);
            if (!list) {
                list = [];
                solutionDotsByCellLayer.set(key, list);
            }
            list.push({ x: px, y: py, w: dw, h: dh });
        }
    }
}

function drawSolutionDotsForCellLayer(r, c, layer) {
    if (!gShowingSolution || solutionDotsByCellLayer.size === 0) return;
    const list = solutionDotsByCellLayer.get(`${r},${c},${layer}`);
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
        const d = list[i];
        fillRectFB(d.x, d.y, d.w, d.h, 1);
    }
}

/* --------------------------------------------------------- penguin & render */
let deviceRelDeg = 0;

function drawPenguinFB() {
    const rows = PENGUIN_SPRITE;
    const sh = rows.length;
    const sw = rows[0].length;
    const rot = ((deviceRelDeg % 360) + 360) % 360;
    const rotated90 = (rot === 90 || rot === 270);
    const drawW = rotated90 ? sh : sw;
    const drawH = rotated90 ? sw : sh;
    const scale = (drawW * 2 <= fbWidth - 16 && drawH * 2 <= fbHeight - 16) ? 2 : 1;
    const x0 = Math.floor((fbWidth - drawW * scale) / 2);
    const y0 = Math.floor((fbHeight - drawH * scale) / 2);

    for (let sy = 0; sy < sh; sy++) {
        const row = rows[sy];
        for (let sx = 0; sx < sw; sx++) {
            const ch = row[sx];
            if (ch === ' ') continue;
            let dx, dy;
            if (rot === 270) {          // -90deg: upright in portrait
                dx = sy;
                dy = sw - 1 - sx;
            } else if (rot === 90) {    // +90deg: upside-down portrait
                dx = sh - 1 - sy;
                dy = sx;
            } else if (rot === 180) {   // 180deg: reverse landscape
                dx = sw - 1 - sx;
                dy = sh - 1 - sy;
            } else {                    // 0deg: normal landscape
                dx = sx;
                dy = sy;
            }
            fillRectFB(x0 + dx * scale, y0 + dy * scale, scale, scale, ch === '#' ? 1 : 0);
        }
    }
}

function renderAll() {
    buildSolutionDotsMap();
    RenderEntireMaze();
    if (gGameWon && showPenguin) {
        drawPenguinFB();
        flushFramebufferToCanvas();
    }
}

/* ------------------------------------------- engine hooks (override globals) */
function updateSolutionButtonUI() {
    btnSolution.textContent = gShowingSolution ? 'Hide Sol' : 'Solution';
    btnSolution.classList.toggle('invert', !!gShowingSolution);
}

function updateLayerIndicator() {
    // No separate layer badge needed in the unified 3D-map-style window
}

function applyCanvasZoom() {
    fxCanvas.width = fbWidth;
    fxCanvas.height = fbHeight;
    layout();
}

function triggerWin() {
    gGameWon = true;
    timerStop();
    if (solutionTimer) {
        clearTimeout(solutionTimer);
        solutionTimer = null;
    }
    gShowingSolution = false;
    activeSolutionNodes = [];
    updateSolutionButtonUI();

    const lvl = clampInt(gSkillLevel, 0, 3);
    if (!solutionUsedThisMaze) {
        recordSolve(lvl, timerElapsed());
    }
    showPenguin = true;
    renderAll();
    updateStatsUI();
    setMenusOpen(true);
    hapticWin();
    playSound('fanfare', 0.9);
    startFireworks();
}

/* ----------------------------------------------------- edge-swipe menu bar */
let menusOpen = false;
let edgeSwipe = null;
let safeInsets = { left: 0, top: 0, right: 0, bottom: 0 };

function setMenusOpen(open) {
    menusOpen = !!open;
    if (menusOpen) {
        statsPanel.style.visibility = 'visible';
        controlsPanel.style.visibility = 'visible';
    }
    document.body.classList.toggle('menus-open', menusOpen);
    layoutMenus(false);
}

window.setDeviceOrientation = function (deg) {
    const norm = (deg === 90 || deg === -90 || deg === 180) ? deg : 0;
    if (norm === deviceRelDeg) return;
    deviceRelDeg = norm;
    layoutMenus(true);
    updateStatsUI();
    if (gGameWon && showPenguin) renderAll();
};

window.setSafeInsets = function (l, t, r, b) {
    safeInsets = {
        left: Math.max(0, l | 0),
        top: Math.max(0, t | 0),
        right: Math.max(0, r | 0),
        bottom: Math.max(0, b | 0)
    };
    layoutMenus(true);
};

function layoutMenus(instant) {
    if (instant) {
        statsPanel.style.transition = 'none';
        controlsPanel.style.transition = 'none';
        if (!menusOpen) {
            statsPanel.style.visibility = 'hidden';
            controlsPanel.style.visibility = 'hidden';
        }
    } else {
        statsPanel.style.transition = '';
        controlsPanel.style.transition = '';
        statsPanel.style.visibility = '';
        controlsPanel.style.visibility = '';
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const { topH: baseTopH, botH: baseBotH } = getBarHeights(H);
    const rot = ((deviceRelDeg % 360) + 360) % 360;
    const isPortrait = (rot === 90 || rot === 270);
    document.body.classList.toggle('menus-portrait', isPortrait);

    const barW = isPortrait ? H : W;
    const barFont = isPortrait
        ? Math.max(13, Math.min(18, Math.round(barW / 23)))
        : Math.max(11, Math.min(18, Math.round(Math.min(baseBotH * 0.40, barW / 42))));

    // Map screen cutout insets (left/top/right/bottom in landscape) to physical top/bottom/sides
    let padTop = 0, padBot = 0, padSideL = 0, padSideR = 0;
    if (rot === 0) {
        padTop = safeInsets.top;
        padBot = safeInsets.bottom;
        padSideL = safeInsets.left;
        padSideR = safeInsets.right;
    } else if (rot === 180) {
        padTop = safeInsets.bottom;
        padBot = safeInsets.top;
        padSideL = safeInsets.right;
        padSideR = safeInsets.left;
    } else if (rot === 270) { // -90deg (upright portrait)
        padTop = safeInsets.left;
        padBot = safeInsets.right;
        padSideL = safeInsets.bottom;
        padSideR = safeInsets.top;
    } else { // +90deg (upside-down portrait)
        padTop = safeInsets.right;
        padBot = safeInsets.left;
        padSideL = safeInsets.top;
        padSideR = safeInsets.bottom;
    }

    const topContentH = isPortrait ? Math.round(barFont * 3.6) : baseTopH;
    const botContentH = isPortrait ? Math.round(barFont * 5.0) : baseBotH;
    const topH = topContentH + padTop;
    const botH = botContentH + padBot;

    statsPanel.style.width = barW + 'px';
    statsPanel.style.height = topH + 'px';
    statsPanel.style.paddingTop = padTop + 'px';
    statsPanel.style.paddingLeft = Math.max(8, padSideL) + 'px';
    statsPanel.style.paddingRight = Math.max(8, padSideR) + 'px';

    controlsPanel.style.width = barW + 'px';
    controlsPanel.style.height = botH + 'px';
    controlsPanel.style.paddingBottom = padBot + 'px';
    controlsPanel.style.paddingLeft = Math.max(10, padSideL) + 'px';
    controlsPanel.style.paddingRight = Math.max(10, padSideR) + 'px';

    statsPanel.style.fontSize = barFont + 'px';
    controlsPanel.style.fontSize = barFont + 'px';

    if (rot === 0) {
        const sY = menusOpen ? 0 : -(topH + 4);
        const cY = menusOpen ? (H - botH) : (H + 4);
        statsPanel.style.transform = `translate(0px, ${sY}px)`;
        controlsPanel.style.transform = `translate(0px, ${cY}px)`;
    } else if (rot === 180) {
        const sY = menusOpen ? H : (H + topH + 4);
        const cY = menusOpen ? botH : -4;
        statsPanel.style.transform = `translate(${W}px, ${sY}px) rotate(180deg)`;
        controlsPanel.style.transform = `translate(${W}px, ${cY}px) rotate(180deg)`;
    } else if (rot === 270) { // -90deg (upright portrait)
        const sX = menusOpen ? 0 : -(topH + 4);
        const cX = menusOpen ? (W - botH) : (W + 4);
        statsPanel.style.transform = `translate(${sX}px, ${H}px) rotate(-90deg)`;
        controlsPanel.style.transform = `translate(${cX}px, ${H}px) rotate(-90deg)`;
    } else { // +90deg (upside-down portrait)
        const sX = menusOpen ? W : (W + topH + 4);
        const cX = menusOpen ? botH : -4;
        statsPanel.style.transform = `translate(${sX}px, 0px) rotate(90deg)`;
        controlsPanel.style.transform = `translate(${cX}px, 0px) rotate(90deg)`;
    }

    if (instant) {
        void statsPanel.offsetWidth;
        statsPanel.style.transition = '';
        controlsPanel.style.transition = '';
    }
    if (statsModalOpen) layoutStatsDialog();
}

/* ------------------------------------------------------------------- layout */
const BASE_WALKS = [55, 110, 170, 240];
const BASE_CELLS = 620;

function getBarHeights(H) {
    const topH = Math.max(26, Math.min(44, Math.round(H * 0.08)));
    const botH = Math.max(36, Math.min(54, Math.round(H * 0.115)));
    return { topH, botH };
}

// Sizes the maze grid to ~2x larger paths (9 rows) and fills the screen at an exact
// integer device-pixel multiple per maze pixel so 1-bit checkerboard & edges stay crisp.
function configureScreenGrid(level) {
    const dpr = window.devicePixelRatio || 1;
    const W_dev = Math.max(240, Math.round(window.innerWidth * dpr));
    const H_dev = Math.max(160, Math.round(window.innerHeight * dpr));

    const rows = 9;
    const fbH = rows * TILE_STRIDE + MARGIN_Y * 2;
    const intScale = Math.max(1, Math.floor(H_dev / fbH));
    const cols = Math.max(12, Math.floor((W_dev / intScale - MARGIN_X * 2) / TILE_STRIDE));

    const cfg = SKILL_CONFIGS[level];
    cfg.rows = rows;
    cfg.cols = cols;
    cfg.numWalks = Math.max(18, Math.round(BASE_WALKS[level] * (rows * cols) / BASE_CELLS));
}

function layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const W_dev = Math.round(W * dpr);
    const H_dev = Math.round(H * dpr);

    macWindow.style.left = '0px';
    macWindow.style.top = '0px';
    macWindow.style.width = W + 'px';
    macWindow.style.height = H + 'px';

    // Exact integer device-pixel scale (always an integer multiple of each 16x16 maze tile)
    const intScale = Math.max(1, Math.floor(Math.min(W_dev / fbWidth, H_dev / fbHeight)));
    const drawW_dev = fbWidth * intScale;
    const drawH_dev = fbHeight * intScale;
    const drawLeft = Math.floor((W_dev - drawW_dev) / 2) / dpr;
    const drawTop = Math.floor((H_dev - drawH_dev) / 2) / dpr;
    const drawW = drawW_dev / dpr;
    const drawH = drawH_dev / dpr;

    for (const c of [canvas, fxCanvas]) {
        c.style.left = drawLeft + 'px';
        c.style.top = drawTop + 'px';
        c.style.width = drawW + 'px';
        c.style.height = drawH + 'px';
    }

    // Match the outer #mazeFrame checkerboard pattern to the exact intScale pixel grid & phase
    const checkPx = intScale / dpr;
    const checkPeriod = checkPx * 2;
    const bgX = drawLeft + checkPx;
    mazeFrame.style.backgroundSize = `${checkPeriod}px ${checkPeriod}px`;
    mazeFrame.style.backgroundPosition =
        `${bgX}px ${drawTop}px, ` +
        `${bgX}px ${drawTop + checkPx}px, ` +
        `${bgX + checkPx}px ${drawTop - checkPx}px, ` +
        `${bgX - checkPx}px ${drawTop}px`;

    layoutMenus(true);
}

window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 120));

/* ------------------------------------------- 1-step BFS finger-drag movement */
let dragging = false;

function hapticStep() {
    if (!hapticsEnabled) return;
    try {
        if (window.AndroidHaptics && window.AndroidHaptics.stepTick) {
            window.AndroidHaptics.stepTick();
        } else if (navigator.vibrate) {
            navigator.vibrate(8);
        }
    } catch (_) { /* ignore */ }
}

function hapticWin() {
    if (!hapticsEnabled) return;
    try {
        if (window.AndroidHaptics && window.AndroidHaptics.winBump) {
            window.AndroidHaptics.winBump();
        } else if (navigator.vibrate) {
            navigator.vibrate(25);
        }
    } catch (_) { /* ignore */ }
}

function clientToGridFloat(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (fbWidth / Math.max(1, rect.width));
    const y = (clientY - rect.top) * (fbHeight / Math.max(1, rect.height));
    return {
        fr: (y - MARGIN_Y) / TILE_STRIDE + 0.5,
        fc: (x - MARGIN_X) / TILE_STRIDE + 0.5
    };
}

// 1-step BFS: checks legal 1-step moves from gPlayer and takes the single step
// that moves closest to the finger, only when the finger is near gPlayer.
function stepOneBfsTowardFinger(fr, fc) {
    if (gGameWon) return;

    const curDistSq = (gPlayer.r - fr) * (gPlayer.r - fr) + (gPlayer.c - fc) * (gPlayer.c - fc);
    if (curDistSq > 1.85 * 1.85 || curDistSq < 0.18) return;

    let bestDir = -1;
    let bestDistSq = curDistSq - 0.08;

    for (let dir = 0; dir < 4; dir++) {
        const step = canMove(gPlayer.r, gPlayer.c, gPlayer.layer, dir);
        if (!step) continue;
        const dSq = (step.r - fr) * (step.r - fr) + (step.c - fc) * (step.c - fc);
        if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestDir = dir;
        }
    }

    if (bestDir === -1) return;

    if (!movePlayerDir(bestDir)) return;
    hapticStep();
}

mazeFrame.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ensureAudio();

    const W = window.innerWidth;
    const H = window.innerHeight;
    const { fr, fc } = clientToGridFloat(e.clientX, e.clientY);
    const distFromPlayer = Math.hypot(fr - gPlayer.r, fc - gPlayer.c);

    // Side-screen swipe inward opens the hidden menus in either landscape or portrait orientation
    const edgeMargin = 38;
    const side = (e.clientX <= edgeMargin) ? 'left'
        : (e.clientX >= W - edgeMargin) ? 'right'
        : (e.clientY <= edgeMargin) ? 'top'
        : (e.clientY >= H - edgeMargin) ? 'bottom'
        : null;
    if (side && (gGameWon || distFromPlayer > 1.35)) {
        edgeSwipe = { id: e.pointerId, startX: e.clientX, startY: e.clientY, side };
        try { mazeFrame.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        return;
    }

    if (gGameWon) {
        showPenguin = !showPenguin;
        setMenusOpen(showPenguin);
        renderAll();
        return;
    }

    if (gShowingSolution) {
        if (solutionTimer) {
            clearTimeout(solutionTimer);
            solutionTimer = null;
        }
        gShowingSolution = false;
        activeSolutionNodes = [];
        updateSolutionButtonUI();
        renderAll();
    }

    if (menusOpen) {
        setMenusOpen(false);
        return;
    }

    // Only grab/drag when touching the player or within 1.5 cells
    if (distFromPlayer <= 1.5) {
        dragging = true;
        try { mazeFrame.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        stepOneBfsTowardFinger(fr, fc);
    }
});

mazeFrame.addEventListener('pointermove', (e) => {
    if (edgeSwipe && e.pointerId === edgeSwipe.id) {
        const dx = e.clientX - edgeSwipe.startX;
        const dy = e.clientY - edgeSwipe.startY;
        const swipedIn = (edgeSwipe.side === 'left' && dx >= 26) ||
            (edgeSwipe.side === 'right' && dx <= -26) ||
            (edgeSwipe.side === 'top' && dy >= 26) ||
            (edgeSwipe.side === 'bottom' && dy <= -26);
        if (swipedIn) {
            setMenusOpen(true);
            edgeSwipe = null;
        }
        return;
    }
    if (!dragging || gGameWon) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (events.length ? events : [e])) {
        const { fr, fc } = clientToGridFloat(ev.clientX, ev.clientY);
        stepOneBfsTowardFinger(fr, fc);
    }
});

const endDrag = (e) => {
    dragging = false;
    if (edgeSwipe && (!e || e.pointerId === edgeSwipe.id)) edgeSwipe = null;
};
mazeFrame.addEventListener('pointerup', endDrag);
mazeFrame.addEventListener('pointercancel', endDrag);

/* --------------------------------------------- buttons & skill radio group */
function attachPressFeedback(el, action) {
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        ensureAudio();
        el.classList.add('pressed');
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    el.addEventListener('pointerup', (e) => {
        if (!el.classList.contains('pressed')) return;
        el.classList.remove('pressed');
        const r = el.getBoundingClientRect();
        const pad = 14;
        if (e.clientX >= r.left - pad && e.clientX <= r.right + pad &&
            e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) {
            playSound('blip', 0.55);
            action();
        }
    });
    el.addEventListener('pointercancel', () => el.classList.remove('pressed'));
}

function renderSkillRadios() {
    const box = document.getElementById('skillRadios');
    box.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const radio = document.createElement('div');
        radio.className = 'mac-radio' + (i === pendingSkill ? ' checked' : '');
        attachPressFeedback(radio, () => selectPendingSkill(i));
        box.appendChild(radio);
    }
}

function selectPendingSkill(i) {
    pendingSkill = clampInt(i, 0, 3);
    localStorage.setItem(STORAGE_PREFIX + 'pendingSkill', String(pendingSkill));
    renderSkillRadios();
    updateStatsUI();
}

function newGame() {
    if (solutionTimer) {
        clearTimeout(solutionTimer);
        solutionTimer = null;
    }
    stopFireworks();
    gSkillLevel = pendingSkill;
    gShowingSolution = false;
    solutionUsedThisMaze = false;
    activeSolutionNodes = [];
    showPenguin = false;
    configureScreenGrid(gSkillLevel);
    MakeMaze();
    timerReset();
    updateSolutionButtonUI();
    updateStatsUI();
    setMenusOpen(false);
}

function toggleSolution() {
    if (gGameWon) return;
    if (gShowingSolution) {
        if (solutionTimer) {
            clearTimeout(solutionTimer);
            solutionTimer = null;
        }
        gShowingSolution = false;
        activeSolutionNodes = [];
    } else {
        solutionUsedThisMaze = true;
        activeSolutionNodes = findShortestPathToEnd();
        gShowingSolution = activeSolutionNodes.length > 1;
        if (solutionTimer) clearTimeout(solutionTimer);
        solutionTimer = setTimeout(() => {
            solutionTimer = null;
            if (gShowingSolution) {
                gShowingSolution = false;
                activeSolutionNodes = [];
                updateSolutionButtonUI();
                renderAll();
            }
        }, SOLUTION_DISPLAY_SECONDS * 1000);
    }
    updateSolutionButtonUI();
    renderAll();
}

attachPressFeedback(btnNew, newGame);
attachPressFeedback(btnSolution, toggleSolution);

const hapticToggleEl = document.getElementById('hapticToggle');
function updateHapticToggleUI() {
    if (!hapticToggleEl) return;
    hapticToggleEl.classList.toggle('checked', hapticsEnabled);
    hapticToggleEl.setAttribute('aria-checked', hapticsEnabled ? 'true' : 'false');
}
if (hapticToggleEl) {
    updateHapticToggleUI();
    attachPressFeedback(hapticToggleEl, () => {
        hapticsEnabled = !hapticsEnabled;
        localStorage.setItem(STORAGE_PREFIX + 'haptics', hapticsEnabled ? '1' : '0');
        updateHapticToggleUI();
        if (hapticsEnabled) hapticStep();
    });
}

/* ----------------------------------------------------- statistics modal */
const btnTrophy = document.getElementById('btnTrophy');
const statsModalBackdrop = document.getElementById('statsModalBackdrop');
const statsDialog = document.getElementById('statsDialog');
const statsTableBody = document.getElementById('statsTableBody');
const statsFooterNormal = document.getElementById('statsFooterNormal');
const statsFooterConfirm = document.getElementById('statsFooterConfirm');
const btnResetStats = document.getElementById('btnResetStats');
const btnCloseStats = document.getElementById('btnCloseStats');
const btnCancelReset = document.getElementById('btnCancelReset');
const btnConfirmReset = document.getElementById('btnConfirmReset');

const LEVEL_NAMES = ['Lv.1 Easy', 'Lv.2', 'Lv.3', 'Lv.4 Hard'];
let statsModalOpen = false;
let pausedByStatsModal = false;

function setResetConfirm(confirming) {
    statsFooterNormal.classList.toggle('hidden', confirming);
    statsFooterConfirm.classList.toggle('hidden', !confirming);
}

function renderStatsTable() {
    if (!statsTableBody) return;
    statsTableBody.innerHTML = '';
    const activeLvl = clampInt(pendingSkill, 0, 3);
    let totalSolves = 0;
    let totalTime = 0;
    let totalTimed = 0;
    let overallBest = 0;

    for (let lvl = 0; lvl < 4; lvl++) {
        const solves = getSolves(lvl);
        const best = getBest(lvl);
        const avg = getAverage(lvl);
        const timed = getTimedSolves(lvl);
        const tSum = getTotalTime(lvl);

        totalSolves += solves;
        if (timed > 0 && tSum > 0) {
            totalTimed += timed;
            totalTime += tSum;
        } else if (solves === 1 && best > 0) {
            totalTimed += 1;
            totalTime += best;
        }
        if (best > 0 && (overallBest <= 0 || best < overallBest)) {
            overallBest = best;
        }

        const tr = document.createElement('tr');
        if (lvl === activeLvl) tr.className = 'active-level';
        tr.innerHTML =
            `<td>${LEVEL_NAMES[lvl]}</td>` +
            `<td>${solves}</td>` +
            `<td>${fmtStatTime(best)}</td>` +
            `<td>${fmtStatTime(avg)}</td>`;
        statsTableBody.appendChild(tr);
    }

    const overallAvg = totalTimed > 0 ? (totalTime / totalTimed) : 0;
    const totalTr = document.createElement('tr');
    totalTr.className = 'total-row';
    totalTr.innerHTML =
        `<td>Total</td>` +
        `<td>${totalSolves}</td>` +
        `<td>${fmtStatTime(overallBest)}</td>` +
        `<td>${fmtStatTime(overallAvg)}</td>`;
    statsTableBody.appendChild(totalTr);
}

function layoutStatsDialog() {
    if (!statsDialog) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const rot = ((deviceRelDeg % 360) + 360) % 360;
    const isPortrait = (rot === 90 || rot === 270);

    const safeW = Math.max(220, (isPortrait ? H : W) - (isPortrait ? safeInsets.top + safeInsets.bottom : safeInsets.left + safeInsets.right) - 24);
    const safeH = Math.max(200, (isPortrait ? W : H) - (isPortrait ? safeInsets.left + safeInsets.right : safeInsets.top + safeInsets.bottom) - 24);
    const dlgW = Math.min(safeW, isPortrait ? 340 : 410);
    const fontPx = Math.max(12, Math.min(16, Math.round(Math.min(dlgW / 24, safeH / 18))));

    statsDialog.style.width = dlgW + 'px';
    statsDialog.style.fontSize = fontPx + 'px';

    const cx = safeInsets.left + (W - safeInsets.left - safeInsets.right) / 2;
    const cy = safeInsets.top + (H - safeInsets.top - safeInsets.bottom) / 2;
    const dlgH = statsDialog.offsetHeight || 240;

    statsDialog.style.left = Math.round(cx - dlgW / 2) + 'px';
    statsDialog.style.top = Math.round(cy - dlgH / 2) + 'px';

    let rotDeg = 0;
    if (rot === 180) rotDeg = 180;
    else if (rot === 270) rotDeg = -90;
    else if (rot === 90) rotDeg = 90;
    statsDialog.style.transform = `rotate(${rotDeg}deg)`;
}

function openStatsModal() {
    if (!statsModalBackdrop) return;
    statsModalOpen = true;
    if (timer.running && !timer.paused) {
        pausedByStatsModal = true;
        pauseGameTimer();
    } else {
        pausedByStatsModal = false;
    }
    setResetConfirm(false);
    renderStatsTable();
    statsModalBackdrop.classList.remove('hidden');
    statsModalBackdrop.setAttribute('aria-hidden', 'false');
    layoutStatsDialog();
}

function closeStatsModal() {
    if (!statsModalBackdrop || !statsModalOpen) return;
    statsModalOpen = false;
    setResetConfirm(false);
    statsModalBackdrop.classList.add('hidden');
    statsModalBackdrop.setAttribute('aria-hidden', 'true');
    if (pausedByStatsModal) {
        pausedByStatsModal = false;
        resumeGameTimer(0);
    }
}

if (btnTrophy) attachPressFeedback(btnTrophy, openStatsModal);
if (btnCloseStats) attachPressFeedback(btnCloseStats, closeStatsModal);
if (btnResetStats) attachPressFeedback(btnResetStats, () => setResetConfirm(true));
if (btnCancelReset) attachPressFeedback(btnCancelReset, () => setResetConfirm(false));
if (btnConfirmReset) {
    attachPressFeedback(btnConfirmReset, () => {
        clearAllStats();
        setResetConfirm(false);
        renderStatsTable();
        updateStatsUI();
    });
}
if (statsModalBackdrop) {
    statsModalBackdrop.addEventListener('pointerdown', (e) => {
        if (e.target === statsModalBackdrop) {
            e.preventDefault();
            closeStatsModal();
        }
    });
}

/* -------------------------------------------------- procedural 1984 audio */
let actx = null;
const sounds = {};
let windStarted = false;

function ensureAudio() {
    try {
        if (!actx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            actx = new AC();
            const sr = actx.sampleRate;
            sounds.blip = makeBuffer(synthBlip(sr), sr);
            sounds.fanfare = makeBuffer(synthFanfare(sr), sr);
            sounds.pop = makeBuffer(synthPop(sr), sr);
            sounds.wind = makeBuffer(synthPineForestWind(sr, 12.0), sr);
        }
        if (actx.state === 'suspended') actx.resume();
        if (!windStarted && sounds.wind) {
            windStarted = true;
            const src = actx.createBufferSource();
            src.buffer = sounds.wind;
            src.loop = true;
            const gain = actx.createGain();
            gain.gain.value = 0.22;
            src.connect(gain).connect(actx.destination);
            src.start();
        }
    } catch (_) { /* audio unavailable */ }
}

document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    try {
        if (document.hidden && actx.state === 'running') actx.suspend();
        else if (!document.hidden && actx.state === 'suspended') actx.resume();
    } catch (_) { /* ignore */ }
});

function makeBuffer(samples, sr) {
    const buf = actx.createBuffer(1, samples.length, sr);
    buf.copyToChannel ? buf.copyToChannel(samples, 0) : buf.getChannelData(0).set(samples);
    return buf;
}

function normalize(data, peak) {
    let max = 0.0001;
    for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
    const g = peak / max;
    for (let i = 0; i < data.length; i++) data[i] = Math.max(-0.98, Math.min(0.98, data[i] * g));
    return data;
}

function synthPineForestWind(sr, durationSec) {
    const total = Math.round(durationSec * sr);
    const raw = new Float32Array(total);
    for (let i = 0; i < total; i++) raw[i] = Math.random() * 2 - 1;

    const out = new Float32Array(total);
    let lpAir = 0, lpHalf = 0, bpNeedle = 0;
    const warmup = sr;
    const aNeedle = Math.min(0.4, Math.max(0.02, 2 * Math.PI * 2200 / sr));

    for (let pass = -warmup; pass < total; pass++) {
        const idx = (pass + total * 2) % total;
        const p = idx / total;
        const rawGust = 0.38
            + 0.22 * Math.sin(p * Math.PI * 2 * 1)
            + 0.16 * Math.sin(p * Math.PI * 2 * 2 + 0.9)
            + 0.12 * Math.sin(p * Math.PI * 2 * 3 + 2.1)
            + 0.08 * Math.sin(p * Math.PI * 2 * 5 + 1.4)
            + 0.04 * Math.sin(p * Math.PI * 2 * 7 + 3.8);
        const gust = Math.max(0, Math.min(1, rawGust * rawGust));

        const fAir = 90 + (220 - 90) * gust;
        const aAir = Math.min(0.1, Math.max(0.002, 2 * Math.PI * fAir / sr));
        lpAir += aAir * (raw[idx] - lpAir);
        lpHalf += aAir * 0.7 * (lpAir - lpHalf);

        bpNeedle += aNeedle * (raw[idx] - bpNeedle);
        const whisper = (raw[idx] - bpNeedle) * (0.04 + 0.08 * gust);

        if (pass >= 0) {
            out[idx] = (lpHalf * 1.8 + whisper) * (0.25 + 0.75 * gust);
        }
    }
    return normalize(out, 0.38);
}

function synthBlip(sr) {
    const n = Math.round(0.065 * sr);
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = 1 - i / n;
        const f = i < n / 2 ? 880 : 1318.5;
        const s = Math.sin(2 * Math.PI * f * t);
        d[i] = (Math.sign(s) * 0.45 + s * 0.55) * env;
    }
    return normalize(d, 0.85);
}

function synthFanfare(sr) {
    const freqs = [392.0, 523.25, 659.25, 783.99, 659.25, 783.99];
    const durs = [0.14, 0.14, 0.14, 0.28, 0.14, 0.65];
    const total = Math.round(durs.reduce((a, b) => a + b, 0) * sr);
    const d = new Float32Array(total);
    let cur = 0;
    for (let n = 0; n < freqs.length; n++) {
        const frames = Math.round(durs[n] * sr);
        const f = freqs[n];
        const last = n === freqs.length - 1;
        for (let i = 0; i < frames && cur + i < total; i++) {
            const t = i / sr;
            const norm = i / frames;
            const attack = Math.min(1, i / (0.008 * sr));
            const decay = last ? Math.pow(1 - norm * 0.85, 1.2) : Math.pow(1 - norm * 0.65, 1.3);
            let s = Math.sin(2 * Math.PI * f * t) * 0.45
                  + Math.sin(2 * Math.PI * f * 2 * t) * 0.30
                  + Math.sin(2 * Math.PI * f * 3 * t) * 0.18
                  + Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.15;
            if (last) s += Math.sin(2 * Math.PI * 523.25 * t) * 0.22 + Math.sin(2 * Math.PI * 659.25 * t) * 0.22;
            d[cur + i] = s * attack * decay;
        }
        cur += frames;
    }
    return normalize(d, 0.95);
}

function synthPop(sr) {
    const n = Math.round(0.38 * sr);
    const d = new Float32Array(n);
    let bp1 = 0, bp2 = 0;
    for (let i = 0; i < n; i++) {
        const t = i / sr;
        const norm = i / n;
        const env = Math.pow(1 - norm, 2);
        const noise = Math.random() * 2 - 1;
        bp1 += 0.32 * (noise - bp1);
        bp2 += 0.06 * (bp1 - bp2);
        const crackle = (bp1 - bp2) * 0.85;
        const punch = Math.sin(2 * Math.PI * (280 + (85 - 280) * Math.sqrt(norm)) * t) * Math.pow(1 - norm, 3.2) * 0.8;
        d[i] = (crackle + punch) * env;
    }
    return normalize(d, 0.92);
}

function playSound(name, volume) {
    if (!actx || !sounds[name]) return;
    try {
        const src = actx.createBufferSource();
        src.buffer = sounds[name];
        const gain = actx.createGain();
        gain.gain.value = volume;
        src.connect(gain).connect(actx.destination);
        src.start();
    } catch (_) { /* ignore */ }
}

/* ------------------------------------------------ 1-bit pixel fireworks */
const fireworks = { particles: [], pending: [], raf: 0, last: 0 };

function startFireworks() {
    stopFireworks();
    const now = performance.now();
    for (let b = 0; b < 6; b++) {
        fireworks.pending.push(now + b * 380 + Math.random() * 120);
    }
    fireworks.last = now;
    fireworks.raf = requestAnimationFrame(stepFireworks);
}

function stopFireworks() {
    if (fireworks.raf) cancelAnimationFrame(fireworks.raf);
    fireworks.raf = 0;
    fireworks.particles.length = 0;
    fireworks.pending.length = 0;
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
}

function spawnBurst() {
    const cx = fbWidth * (0.15 + Math.random() * 0.7);
    const cy = fbHeight * (0.12 + Math.random() * 0.45);
    const count = 26 + Math.floor(Math.random() * 10);
    const speed = 45 + Math.random() * 40;
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const v = speed * (0.75 + Math.random() * 0.4);
        fireworks.particles.push({
            x: cx, y: cy,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            life: 1.1 + Math.random() * 0.7, age: 0
        });
    }
    playSound('pop', 0.6);
}

function stepFireworks(now) {
    const dt = Math.min(0.05, (now - fireworks.last) / 1000);
    fireworks.last = now;

    while (fireworks.pending.length && fireworks.pending[0] <= now) {
        fireworks.pending.shift();
        spawnBurst();
    }

    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    const alive = [];
    for (const p of fireworks.particles) {
        p.age += dt;
        if (p.age >= p.life) continue;
        p.vy += 38 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        alive.push(p);
        const fading = p.life - p.age < 0.35;
        if (fading && (Math.floor(p.age * 20) & 1)) continue;
        const x = Math.round(p.x), y = Math.round(p.y);
        fxCtx.fillStyle = '#fff';
        fxCtx.fillRect(x - 1, y - 1, 4, 4);
        fxCtx.fillStyle = '#000';
        fxCtx.fillRect(x, y, 2, 2);
    }
    fireworks.particles = alive;

    if (alive.length || fireworks.pending.length) {
        fireworks.raf = requestAnimationFrame(stepFireworks);
    } else {
        fireworks.raf = 0;
        fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    }
}

/* -------------------------------------------------------------- startup */
function start() {
    renderSkillRadios();
    newGame();
    layout();
}

document.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('load', () => {
    const go = () => start();
    if (document.fonts && document.fonts.load) {
        document.fonts.load("16px 'Chicago'").then(go, go);
    } else {
        go();
    }
});
