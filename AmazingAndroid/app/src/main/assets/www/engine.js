/* ==========================================================================
 * Amazing (1984) maze engine - extracted verbatim from the web port
 * (../../../../../amazing_1984_macintosh_port.html): bitmaps, 1-bit framebuffer,
 * DRAWSQUA renderer, MAKEMAZE generator, movement engine and DFS solver.
 * UI glue (stats, buttons, layout, sound, penguin) lives in app.js.
 * ========================================================================== */

        const HEX_LNIB = [
            "0000000000008000800080008000800080008000800080000000000000000000",
            "0000000000000000000000000000000000000000000000000000000000001FF8",
            "0000000000000001000100010001000100010001000100010000000000000000",
            "1FF8000000000000000000000000000000000000000000000000000000000000",
            "000000000000FFF8FFF8FFF8FFF8FFF8FFF8FFF8FFF8FFF80000000000000000",
            "0000000000001FF81FF81FF81FF81FF81FF81FF81FF81FF81FF81FF81FF81FF8",
            "0000000000001FFF1FFF1FFF1FFF1FFF1FFF1FFF1FFF1FFF0000000000000000",
            "1FF81FF81FF81FF81FF81FF81FF81FF81FF81FF81FF81FF80000000000000000"
        ];

        const HEX_UNIB = [
            "0000000000000000000000000000F800F8000000000000000000000000000000",
            "0000000000000000000000000000000000000000000001800180018001800180",
            "0000000000000000000000000000001F001F0000000000000000000000000000",
            "0180018001800180018000000000000000000000000000000000000000000000",
            "0000000000008000C000E000F000FF80FF80F000E000C0008000000000000000",
            "00000000000000000000000000000180018001800180018003C007E00FF01FF8",
            "000000000000000100030007000F01FF01FF000F000700030001000000000000",
            "1FF80FF007E003C0018001800180018001800000000000000000000000000000",
            "0000000000000000000000000000FF80FF800000000000000000000000000000",
            "0000000000000000000000000000018001800180018001800180018001800180",
            "000000000000000000000000000001FF01FF0000000000000000000000000000",
            "0180018001800180018001800180018001800000000000000000000000000000"
        ];

        const HEX_UMAS = [
            "00000000000000000000F800F800F800F800F800F80000000000000000000000",
            "0000000000000000000000000000000000000000000007E007E007E007E007E0",
            "00000000000000000000001F001F001F001F001F001F00000000000000000000",
            "07E007E007E007E007E000000000000000000000000000000000000000000000",
            "00008000C000E000F000FC00FC00FC00FC00FC00FC00F000E000C00080000000",
            "000000000000000000000000000000000000000007E007E00FF01FF83FFC7FFE",
            "0000000100030007000F003F003F003F003F003F003F000F0007000300010000",
            "7FFE3FFC1FF80FF007E007E00000000000000000000000000000000000000000",
            "00000000000000000000FC00FC00FC00FC00FC00FC0000000000000000000000",
            "000000000000000000000000000000000000000007E007E007E007E007E007E0",
            "00000000000000000000003F003F003F003F003F003F00000000000000000000",
            "07E007E007E007E007E007E00000000000000000000000000000000000000000"
        ];

        const HEX_ULIN = [
            "00000000000000000000FC000000000000000000FC0000000000000000000000",
            "0000000000000000000000000000000000000000042004200420042004200420",
            "00000000000000000000003F0000000000000000003F00000000000000000000",
            "0420042004200420042004200000000000000000000000000000000000000000",
            "000080004000200010000C0000000000000000000C0010002000400080000000",
            "0000000000000000000000000000000000000000042004200810100820044002",
            "0000000100020004000800300000000000000000003000080004000200010000",
            "4002200410080810042004200000000000000000000000000000000000000000"
        ];

        const HEX_LBM = [
            "0000C000000000000000000000000000000000000000000000000000C0000000",
            "0000000000000000000000000000000000000000000000000000000040024002",
            "0000000300000000000000000000000000000000000000000000000000030000",
            "4002400200000000000000000000000000000000000000000000000000000000",
            "0000800080008000800080008000800080008000800080008000800080000000",
            "0000000000000000000000000000000000000000000000000000000000007FFE",
            "0000000100010001000100010001000100010001000100010001000100010000",
            "7FFE000000000000000000000000000000000000000000000000000000000000",
            "0000C000C000C000C000C000C000C000C000C000C000C000C000C000C0000000",
            "000000000000000000000000000000000000000000000000000000007FFE7FFE",
            "0000000300030003000300030003000300030003000300030003000300030000",
            "7FFE7FFE00000000000000000000000000000000000000000000000000000000"
        ];

        // INITMAIN: Start/End Goal Square Markers (Large 14x14 & Small 6x6 hollow/solid squares)
        const HEX_MARKERS = [
            "00007FFE4002400240024002400240024002400240024002400240027FFE0000",
            "00007FFE7FFE7FFE7FFE7FFE7FFE7FFE7FFE7FFE7FFE7FFE7FFE7FFE7FFE0000",
            "0000000000000000000007E0042004200420042007E000000000000000000000",
            "0000000000000000000007E007E007E007E007E007E000000000000000000000"
        ];

        function parseBitmapHex(hexStr) {
            const rows = new Uint16Array(16);
            for (let i = 0; i < 16; i++) {
                rows[i] = parseInt(hexStr.substr(i * 4, 4), 16);
            }
            return rows;
        }

        // Exact 12-entry tables reconstructed per INITLNIB, INITUNIB, INITUMAS, INITULIN, INITLBM
        // Note: In INITLBM, indices 0..17 are populated; we parse the raw 12 strings plus derived masks.
        const RAW_LNIB = HEX_LNIB.map(parseBitmapHex);
        const RAW_UNIB = HEX_UNIB.map(parseBitmapHex);
        const UMAS     = HEX_UMAS.map(parseBitmapHex);
        const RAW_ULIN = HEX_ULIN.map(parseBitmapHex);
        const RAW_LBM  = HEX_LBM.map(parseBitmapHex);
        const MARKERS  = HEX_MARKERS.map(parseBitmapHex);

        // In INITULIN (see disassembly: 12 entries: 0..3 = narrow stub walls, 4..7 = diagonal funnel walls, 8..11 = narrow full walls)
        const ULIN = [
            RAW_ULIN[0], RAW_ULIN[1], RAW_ULIN[2], RAW_ULIN[3], // 0..3: Stub walls (5px long at edge)
            RAW_ULIN[4], RAW_ULIN[5], RAW_ULIN[6], RAW_ULIN[7], // 4..7: 45-deg diagonal flare walls
            RAW_ULIN[0], RAW_ULIN[1], RAW_ULIN[2], RAW_ULIN[3]  // 8..11: Narrow corridor walls
        ];

        /* ============================================================================
         * 2. EXACT DISASSEMBLY ANALYSIS OF DRAWSQUA & THE 6 SKILL LEVELS
         * ============================================================================
         * Look at the disassembly of `DRAWSQUA` (offset 0x0000) and `INITMAZE` (offset 0x013E):
         *
         * In `INITMAZE`:
         *   - Window portRect is approximately 512x310 on a Macintosh screen.
         *   - Every cell is placed at pixel coordinate:
         *       `x = (col - 1) * 16 + leftMargin`
         *       `y = (row - 1) * 16 + topMargin`
         *     Wait—look closely at the instructions in `DRAWSQUA`:
         *       `0-Žª Áü 0010` (`muls #16, d0`) or `muls #12, d0`!
         *     And look at the 4 screenshots provided by the user:
         *       - Screenshot 1 (Easy): ~15 rows × 25 cols. Single layer, wide corridors (12px white path,
         *         1px black wall, 2px grey checkerboard between parallel walls). Solid black circle (●)
         *         and solid black square (■) inside the corridors!
         *       - Screenshot 2 (Medium-Easy): ~15 rows × 25 cols. Wide corridors WITH wide bridges
         *         (overpasses where one wide corridor crosses straight over another wide corridor!).
         *       - Screenshot 3 (Medium-Hard): ~20 rows × 33 cols. Wide Lower Layer corridors + Narrow
         *         Upper Layer corridors (`UMAS`/`ULIN`) with 45-degree diagonal funnel ramps (`ULIN[4..7]`)
         *         where paths switch between wide and narrow layers!
         *       - Screenshot 4 (Hard): ~20 rows × 33 cols. High-density 2-layer weave with frequent
         *         45-degree diagonal funnel ramps (`ISRAMP`) and narrow overpasses everywhere!
         */

        const DIR_LEFT  = 0; // West  (bit 0 = 0x01)
        const DIR_DOWN  = 1; // South (bit 1 = 0x02)
        const DIR_RIGHT = 2; // East  (bit 2 = 0x04)
        const DIR_UP    = 3; // North (bit 3 = 0x08)

        /*
         * THE 4 SUB-LAYERS OF STEVE CAPPS' MAZE ARCHITECTURE:
         * ---------------------------------------------------
         * Plane 1 (WIDE LOWER MAZE - 14px wide, walls at 1 & 14):
         *   - Sub-layer 1: Wide Base Path
         *   - Sub-layer 2: Wide 90° Overpass Bridge
         * Plane 2 (NARROW UPPER MAZE - 6px wide, walls at 5 & 10, drawn ON TOP of Plane 1):
         *   - Sub-layer 3: Narrow Base Path (can go anywhere on top of Plane 1!)
         *   - Sub-layer 4: Narrow 90° Overpass Bridge
         *
         * Diagonal Ramps (`ISRAMP`):
         *   - Transition between Plane 1 (Sub-layer 1) and Plane 2 (Sub-layer 3).
         */
        const LAYER_WIDE_BASE     = 1;
        const LAYER_WIDE_BRIDGE   = 2;
        const LAYER_NARROW_BASE   = 3;
        const LAYER_NARROW_BRIDGE = 4;

        // The 4 Authentic Skill Levels sized for 2x larger touch paths on Android
        const SKILL_CONFIGS = [
            {
                rows: 9, cols: 16,
                allowWideBridges: false,
                allowNarrowPlane: false,
                allowNarrowBridges: false,
                numWalks: 24, rampChance: 0, bridgeChance: 0,
                label: "Level 1 (Easy): Wide paths only, no overpasses"
            },
            {
                rows: 9, cols: 16,
                allowWideBridges: true,
                allowNarrowPlane: false,
                allowNarrowBridges: false,
                numWalks: 55, rampChance: 0, bridgeChance: 0.65,
                label: "Level 2: Wide paths with 90° wide overpasses"
            },
            {
                rows: 9, cols: 16,
                allowWideBridges: true,
                allowNarrowPlane: true,
                allowNarrowBridges: true,
                numWalks: 120, rampChance: 0.16, bridgeChance: 0.70,
                label: "Level 3: Separate Narrow Upper Maze on top of Wide Maze + overpasses & ramps"
            },
            {
                rows: 9, cols: 16,
                allowWideBridges: true,
                allowNarrowPlane: true,
                allowNarrowBridges: true,
                numWalks: 190, rampChance: 0.24, bridgeChance: 0.92,
                label: "Level 4 (Hard): Maximum wide & narrow overpasses (up to 4 paths/cell) & ramp transitions"
            }
        ];

        let gSkillLevel = 0; // Default to Level 1 (Easy)
        let gMaxRow = 19;
        let gMaxCol = 31;
        let gZoom = 1.5;     // Crisp pixel display multiplier for modern monitors

        // 3D Maze array: gMaze[r][c][subLayer] where subLayer is 1..4:
        //   1 = Wide Base, 2 = Wide 90° Overpass, 3 = Narrow Base, 4 = Narrow 90° Overpass
        // Bits 0..3: connections W, S, E, N
        // Bit 4 (0x10): Visited by player
        // Bit 5 (0x20): Marked by Solution solver
        // Bit 7 (0x80): Ramp connecting Wide Base (1) <-> Narrow Base (3)
        let gMaze = [];
        let gNibMask = [];

        let gStartPos = { r: 1, c: 1, layer: LAYER_WIDE_BASE };
        let gEndPos   = { r: 10, c: 10, layer: LAYER_WIDE_BASE };
        let gPlayer   = { r: 1, c: 1, layer: LAYER_WIDE_BASE };
        let gPathHistory = []; // Stack of {r, c, layer} for smooth backtracking when dragging!
        let gSavedPreSolutionState = null; // Stores player's progress before showing Solution

        let gGameWon = false;
        let gShowingSolution = false;
        let gPigMode = false;
        let gPigTimer = null;

        const canvas = document.getElementById('mazeCanvas');
        const ctx = canvas.getContext('2d');

        // 1-bit Pixel Framebuffer (width * height bytes: 0 = white, 1 = black)
        let fbWidth = 496;
        let fbHeight = 304;
        let fbPixels = new Uint8Array(fbWidth * fbHeight);

        /* ============================================================================
         * 3. LOW-LEVEL 1-BIT QUICKDRAW FRAMEBUFFER OPERATIONS
         * ============================================================================ */

        function initFramebuffer(w, h) {
            fbWidth = w;
            fbHeight = h;
            fbPixels = new Uint8Array(w * h);
            canvas.width = w;
            canvas.height = h;
            applyCanvasZoom();

            // Fill entire canvas with QuickDraw's 50% grey checkerboard pattern (`qd.gray`)
            // Plus 1px solid black outer frame at top/left/bottom/right
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    fbPixels[y * w + x] = ((x + y) & 1) === 0 ? 1 : 0;
                }
            }
        }

        function applyCanvasZoom() {
            canvas.style.width = `${Math.round(fbWidth * gZoom)}px`;
            canvas.style.height = `${Math.round(fbHeight * gZoom)}px`;
        }

        function setPixel(x, y, val) {
            if (x >= 0 && x < fbWidth && y >= 0 && y < fbHeight) {
                fbPixels[y * fbWidth + x] = val;
            }
        }

        function fillRectFB(x0, y0, w, h, val) {
            for (let y = y0; y < y0 + h; y++) {
                if (y < 0 || y >= fbHeight) continue;
                for (let x = x0; x < x0 + w; x++) {
                    if (x >= 0 && x < fbWidth) {
                        fbPixels[y * fbWidth + x] = val;
                    }
                }
            }
        }

        function fillGrayRectFB(x0, y0, w, h) {
            for (let y = y0; y < y0 + h; y++) {
                if (y < 0 || y >= fbHeight) continue;
                for (let x = x0; x < x0 + w; x++) {
                    if (x >= 0 && x < fbWidth) {
                        fbPixels[y * fbWidth + x] = ((x + y) & 1) === 0 ? 1 : 0;
                    }
                }
            }
        }

        // CopyBits a 16x16 uint16 bitmap at (dstX, dstY) using QuickDraw transfer mode:
        //   mode = 'srcOr'  (1 bits -> black)
        //   mode = 'srcBic' (1 bits -> white)
        function copyBits16(bitmap16, dstX, dstY, mode) {
            for (let row = 0; row < 16; row++) {
                const py = dstY + row;
                if (py < 0 || py >= fbHeight) continue;
                const bits = bitmap16[row];
                if (bits === 0) continue;
                for (let col = 0; col < 16; col++) {
                    if ((bits & (0x8000 >> col)) !== 0) {
                        const px = dstX + col;
                        if (px >= 0 && px < fbWidth) {
                            fbPixels[py * fbWidth + px] = (mode === 'srcOr') ? 1 : 0;
                        }
                    }
                }
            }
        }

        function flushFramebufferToCanvas() {
            const imgData = ctx.createImageData(fbWidth, fbHeight);
            const data = imgData.data;
            for (let i = 0; i < fbPixels.length; i++) {
                const c = fbPixels[i] ? 0 : 255;
                const idx = i * 4;
                data[idx]     = c;
                data[idx + 1] = c;
                data[idx + 2] = c;
                data[idx + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
        }

        /* ============================================================================
         * 4. CORE DECOMPILED PASCAL/68K FUNCTIONS (GETSQUAR, NEIGHBOR, ISBRIDGE, ETC.)
         * ============================================================================ */

        function allocateGrid(rows, cols) {
            gMaze = [];
            gNibMask = [];
            for (let r = 0; r <= rows + 1; r++) {
                gMaze[r] = [];
                gNibMask[r] = [];
                for (let c = 0; c <= cols + 1; c++) {
                    gMaze[r][c] = [0, 0, 0, 0, 0];
                    gNibMask[r][c] = [0, 0, 0, 0, 0];
                }
            }
        }

        function GetSquare(r, c, layer) {
            if (r < 0 || r > gMaxRow + 1 || c < 0 || c > gMaxCol + 1) return 0x0F;
            return gMaze[r][c][layer] || 0;
        }

        function PutSquare(r, c, layer, val) {
            if (r >= 0 && r <= gMaxRow + 1 && c >= 0 && c <= gMaxCol + 1) {
                gMaze[r][c][layer] = val & 0xFF;
            }
        }

        function MarkSquare(r, c, layer, bitIndex) {
            PutSquare(r, c, layer, GetSquare(r, c, layer) | (1 << bitIndex));
        }

        function MemberOf(bitIndex, r, c, layer) {
            return (GetSquare(r, c, layer) & (1 << bitIndex)) !== 0;
        }

        function isWideSubLayer(layer) {
            return layer === LAYER_WIDE_BASE || layer === LAYER_WIDE_BRIDGE;
        }

        function isNarrowSubLayer(layer) {
            return layer === LAYER_NARROW_BASE || layer === LAYER_NARROW_BRIDGE;
        }

        function baseLayerOfPlane(layer) {
            return isWideSubLayer(layer) ? LAYER_WIDE_BASE : LAYER_NARROW_BASE;
        }

        function bridgeLayerOfPlane(layer) {
            return isWideSubLayer(layer) ? LAYER_WIDE_BRIDGE : LAYER_NARROW_BRIDGE;
        }

        function DirOpp(dir) {
            return (dir + 2) & 3;
        }

        function stepCoord(r, c, dir) {
            switch (dir) {
                case DIR_LEFT:  return { r, c: c - 1 };
                case DIR_DOWN:  return { r: r + 1, c };
                case DIR_RIGHT: return { r, c: c + 1 };
                case DIR_UP:    return { r: r - 1, c };
            }
            return { r, c };
        }

        function SquareFree(r, c, layer) {
            if (r < 1 || r > gMaxRow || c < 1 || c > gMaxCol) return false;
            return (GetSquare(r, c, layer) & 0x8F) === 0;
        }

        function IsRamp(r, c) {
            if (r < 1 || r > gMaxRow || c < 1 || c > gMaxCol) return false;
            return MemberOf(7, r, c, LAYER_WIDE_BASE) || MemberOf(7, r, c, LAYER_NARROW_BASE);
        }

        // Checks if `(r, c)` on `baseLayer` (1 for Wide, 3 for Narrow) is a straight segment
        // perpendicular to `moveDir` so a 90° overpass bridge can cross right over it!
        function IsBridge(r, c, baseLayer, moveDir) {
            if (r <= 1 || r >= gMaxRow || c <= 1 || c >= gMaxCol) return false;
            if (IsRamp(r, c)) return false;
            const bridgeLayer = bridgeLayerOfPlane(baseLayer);
            if (!SquareFree(r, c, bridgeLayer)) return false;

            const sq = GetSquare(r, c, baseLayer) & 0x0F;
            if (moveDir === DIR_LEFT || moveDir === DIR_RIGHT) {
                return sq === ((1 << DIR_UP) | (1 << DIR_DOWN));
            } else {
                return sq === ((1 << DIR_LEFT) | (1 << DIR_RIGHT));
            }
        }

        // Checks if `(r, c)` on `otherLayer` is a singledead-end stub that hasn't finished
        // or if it is a valid straight perpendicular corridor that can be crossed over/under.
        function canCrossPerpendicular(r, c, otherLayer, moveDir) {
            return IsBridge(r, c, otherLayer, moveDir);
        }

        /* ============================================================================
         * 5. AUTHENTIC DRAWSQUA IMPLEMENTATION (15px STRIDE OVERLAPPING TILES)
         * ============================================================================
         * Look at the disassembly of `DRAWSQUA`:
         *   `0-Žª Áü 000F` (`muls #15, d0`) or `muls #16, d0` with 2px shared walls:
         *   Let's check the exact bit indices of `RAW_LNIB`, `RAW_LBM`, `UMAS`, `ULIN`:
         *   - In `RAW_LBM[4]` (West wall): bit 15 (`0x8000`, col 0) is set on rows 1..14.
         *   - In `RAW_LBM[6]` (East wall): bit 0 (`0x0001`, col 15) is set on rows 1..14.
         *   - In `RAW_LBM[7]` (North wall): bits 1..14 (`0x7FFE`, cols 1..14) are set on row 0.
         *   - In `RAW_LBM[5]` (South wall): bits 1..14 (`0x7FFE`, cols 1..14) are set on row 15.
         *   Notice that!
         *   - North wall is at `row 0`, South wall is at `row 15` -> inside the 16x16 tile,
         *     rows 1..14 (14px) are the interior, and between row 15 of tile `(r, c)` and
         *     row 0 of tile `(r+1, c)`, if the stride is 18px (leaving 2px of grey checkerboard
         *     between row 15 and row 0 of the next tile!), OR if we look at `UMAS`/`ULIN`:
         *     In `ULIN[4]` (West diagonal funnel):
         *       row 1 has `0x8000` (col 0)
         *       row 14 has `0x8000` (col 0)
         *     That proves the Wide (Lower Layer) corridor inside a 16x16 tile occupies
         *     **rows 2..13** (12 pixels high) with its 1px black walls at **row 1 and row 14**!
         *     And horizontally, the Wide corridor occupies **cols 2..13** (12 pixels wide)
         *     with its 1px black walls at **col 1 and col 14**!
         *     Then row 0 and row 15 (1px each on adjacent tiles = 2px total!) and col 0 and col 15
         *     (1px each on adjacent tiles = 2px total!) remain untouched 50% grey checkerboard!
         *
         *   Let's verify this!
         *   - If each tile is 16×16 at stride 16:
         *     - Tile `(r, c)` has grey checkerboard at `row 0` and `row 15`, `col 0` and `col 15`.
         *     - Adjacent tiles share `(row 15 of r)` + `(row 0 of r+1)` = **2 pixels of 50% grey checkerboard**!
         *     - Lower Layer walls are at `row 1` and `row 14`, `col 1` and `col 14` (1px black)!
         *     - Lower Layer white interior is `rows 2..13`, `cols 2..13` (12px wide white path)!
         *     - And look at `ULIN[4]` (`0000 8000 4000 2000 1000 0C00 0000 0000 0000 0000 0C00 1000 2000 4000 8000 0000`):
         *       * Row 0: `0000` (grey)
         *       * Row 1: `8000` (col 0 — joins the 1px black wall at row 1!)
         *       * Row 2: `4000` (col 1)
         *       * Row 3: `2000` (col 2)
         *       * Row 4: `1000` (col 3)
         *       * Row 5: `0C00` (cols 4, 5 — joins the narrow Upper Layer wall at row 5!)
         *       * Rows 6..9: `0000` (4px/6px white narrow Upper Layer interior!)
         *       * Row 10: `0C00` (cols 4, 5 — joins the narrow Upper Layer wall at row 10!)
         *       * Row 11: `1000` (col 3)
         *       * Row 12: `2000` (col 2)
         *       * Row 13: `4000` (col 1)
         *       * Row 14: `8000` (col 0 — joins the 1px black wall at row 14!)
         *       * Row 15: `0000` (grey)
         *     Everything lines up to the exact pixel when:
         *       - Wide Lower Layer corridor has walls at **1 and 14** (interior 2..13 = 12px wide)
         *       - Narrow Upper Layer corridor has walls at **5 and 10** (interior 6..9 = 4px/6px wide)
         *       - Between adjacent tiles is **row/col 15 and row/col 0** = 2px of 50% grey checkerboard!
         */

        const TILE_STRIDE = 16;
        const MARGIN_X = 2;
        const MARGIN_Y = 2;

        function cellOrigin(r, c) {
            return {
                x: MARGIN_X + (c - 1) * TILE_STRIDE,
                y: MARGIN_Y + (r - 1) * TILE_STRIDE
            };
        }

        // Draw a single 16x16 square at (r, c) using the exact coordinates of Steve Capps' bitmaps:
        //   - Wide Lower Layer:
        //       * Black 1px walls at Row/Col 1 and Row/Col 14
        //       * White 12px corridor interior at Rows/Cols 2..13
        //       * Black 10px solution/player fill at Rows/Cols 3..12 (leaving a uniform 1px white margin at Row/Col 2 and 13, eliminating any bumps!)
        //   - Narrow Upper Layer:
        //       * Black 1px walls (`ULIN`) at Row/Col 5 and Row/Col 10
        //       * White 4px corridor interior (`UMAS`) at Rows/Cols 6..9
        //       * Black 2px solution/player fill (`UNIB`) at Rows/Cols 7..8 (leaving a uniform 1px white margin at Row/Col 6 and 9!)
        //   - 45° Diagonal Ramp (`ISRAMP`):
        //       * Transitions smoothly from Wide (walls at 1 & 14, fill at 3..12) to Narrow (walls at 5 & 10, fill at 7..8)
        function DrawSquare(r, c) {
            if (r < 1 || r > gMaxRow || c < 1 || c > gMaxCol) return;
            const { x: ox, y: oy } = cellOrigin(r, c);

            // 1. Reset cell to 50% grey checkerboard (`qd.gray`)
            fillGrayRectFB(ox, oy, 16, 16);

            const wBase   = GetSquare(r, c, LAYER_WIDE_BASE);
            const wBridge = GetSquare(r, c, LAYER_WIDE_BRIDGE);
            const nBase   = GetSquare(r, c, LAYER_NARROW_BASE);
            const nBridge = GetSquare(r, c, LAYER_NARROW_BRIDGE);

            const wBaseOpen   = wBase & 0x0F;
            const wBridgeOpen = wBridge & 0x0F;
            const nBaseOpen   = nBase & 0x0F;
            const nBridgeOpen = nBridge & 0x0F;
            const isRamp      = IsRamp(r, c);

            // Helper to draw a WIDE corridor (walls at 1 & 14, white interior at 2..13)
            function drawWideCorridor(openMask) {
                if (openMask === 0) return;

                // Clear center 12x12 interior (rows 2..13, cols 2..13) to white
                fillRectFB(ox + 2, oy + 2, 12, 12, 0);

                // Open stubs to edges
                if (openMask & (1 << DIR_LEFT)) {
                    fillRectFB(ox, oy + 2, 2, 12, 0);
                    fillRectFB(ox, oy + 1, 2, 1, 1);
                    fillRectFB(ox, oy + 14, 2, 1, 1);
                }
                if (openMask & (1 << DIR_RIGHT)) {
                    fillRectFB(ox + 14, oy + 2, 2, 12, 0);
                    fillRectFB(ox + 14, oy + 1, 2, 1, 1);
                    fillRectFB(ox + 14, oy + 14, 2, 1, 1);
                }
                if (openMask & (1 << DIR_UP)) {
                    fillRectFB(ox + 2, oy, 12, 2, 0);
                    fillRectFB(ox + 1, oy, 1, 2, 1);
                    fillRectFB(ox + 14, oy, 1, 2, 1);
                }
                if (openMask & (1 << DIR_DOWN)) {
                    fillRectFB(ox + 2, oy + 14, 12, 2, 0);
                    fillRectFB(ox + 1, oy + 14, 1, 2, 1);
                    fillRectFB(ox + 14, oy + 14, 1, 2, 1);
                }

                // Closed walls at 1 and 14
                if (!(openMask & (1 << DIR_LEFT)))  fillRectFB(ox + 1, oy + 1, 1, 14, 1);
                if (!(openMask & (1 << DIR_RIGHT))) fillRectFB(ox + 14, oy + 1, 1, 14, 1);
                if (!(openMask & (1 << DIR_UP)))    fillRectFB(ox + 1, oy + 1, 14, 1, 1);
                if (!(openMask & (1 << DIR_DOWN)))  fillRectFB(ox + 1, oy + 14, 14, 1, 1);

                // Inner corners
                setPixel(ox + 1, oy + 1, 1);
                setPixel(ox + 14, oy + 1, 1);
                setPixel(ox + 1, oy + 14, 1);
                setPixel(ox + 14, oy + 14, 1);
            }

            // Helper to draw a WIDE 90° Overpass Bridge (cuts cleanly across the perpendicular wide underpass)
            function drawWideOverpass(openMask) {
                if (openMask === 0) return;
                if (openMask & ((1 << DIR_LEFT) | (1 << DIR_RIGHT))) {
                    fillRectFB(ox, oy + 2, 16, 12, 0);
                    fillRectFB(ox, oy + 1, 16, 1, 1);
                    fillRectFB(ox, oy + 14, 16, 1, 1);
                } else {
                    fillRectFB(ox + 2, oy, 12, 16, 0);
                    fillRectFB(ox + 1, oy, 1, 16, 1);
                    fillRectFB(ox + 14, oy, 1, 16, 1);
                }
            }

            // Helper to draw a NARROW corridor (walls at 5 & 10, white interior at 6..9)
            // Drawn ON TOP of the Wide Maze (leaving cols/rows 1..4 and 11..14 of the Wide Maze visible!)
            function drawNarrowCorridor(openMask) {
                if (openMask === 0) return;

                // Clear center 4x4 interior (rows 6..9, cols 6..9) to white
                fillRectFB(ox + 6, oy + 6, 4, 4, 0);

                if (openMask & (1 << DIR_LEFT)) {
                    fillRectFB(ox, oy + 6, 6, 4, 0);
                    fillRectFB(ox, oy + 5, 6, 1, 1);
                    fillRectFB(ox, oy + 10, 6, 1, 1);
                }
                if (openMask & (1 << DIR_RIGHT)) {
                    fillRectFB(ox + 10, oy + 6, 6, 4, 0);
                    fillRectFB(ox + 10, oy + 5, 6, 1, 1);
                    fillRectFB(ox + 10, oy + 10, 6, 1, 1);
                }
                if (openMask & (1 << DIR_UP)) {
                    fillRectFB(ox + 6, oy, 4, 6, 0);
                    fillRectFB(ox + 5, oy, 1, 6, 1);
                    fillRectFB(ox + 10, oy, 1, 6, 1);
                }
                if (openMask & (1 << DIR_DOWN)) {
                    fillRectFB(ox + 6, oy + 10, 4, 6, 0);
                    fillRectFB(ox + 5, oy + 10, 1, 6, 1);
                    fillRectFB(ox + 10, oy + 10, 1, 6, 1);
                }

                // Closed center walls at 5 and 10
                if (!(openMask & (1 << DIR_LEFT)))  fillRectFB(ox + 5, oy + 5, 1, 6, 1);
                if (!(openMask & (1 << DIR_RIGHT))) fillRectFB(ox + 10, oy + 5, 1, 6, 1);
                if (!(openMask & (1 << DIR_UP)))    fillRectFB(ox + 5, oy + 5, 6, 1, 1);
                if (!(openMask & (1 << DIR_DOWN)))  fillRectFB(ox + 5, oy + 10, 6, 1, 1);

                setPixel(ox + 5, oy + 5, 1);
                setPixel(ox + 10, oy + 5, 1);
                setPixel(ox + 5, oy + 10, 1);
                setPixel(ox + 10, oy + 10, 1);
            }

            // Helper to draw a NARROW 90° Overpass Bridge on top of the Narrow Base corridor
            function drawNarrowOverpass(openMask) {
                if (openMask === 0) return;
                if (openMask & ((1 << DIR_LEFT) | (1 << DIR_RIGHT))) {
                    fillRectFB(ox, oy + 6, 16, 4, 0);
                    fillRectFB(ox, oy + 5, 16, 1, 1);
                    fillRectFB(ox, oy + 10, 16, 1, 1);
                } else {
                    fillRectFB(ox + 6, oy, 4, 16, 0);
                    fillRectFB(ox + 5, oy, 1, 16, 1);
                    fillRectFB(ox + 10, oy, 1, 16, 1);
                }
            }

            // Helper to draw a 45° Diagonal Funnel stub in direction `dir`
            // (flares cleanly from narrow center [5..10] out to wide edge [1..14])
            function drawDiagonalFunnelStub(dir) {
                if (dir === DIR_LEFT) {
                    for (let dx = 0; dx <= 5; dx++) {
                        const topY = (dx === 0) ? 1 : dx;
                        const botY = (dx === 0) ? 14 : (15 - dx);
                        for (let dy = topY + 1; dy < botY; dy++) setPixel(ox + dx, oy + dy, 0);
                        setPixel(ox + dx, oy + topY, 1);
                        setPixel(ox + dx, oy + botY, 1);
                    }
                } else if (dir === DIR_RIGHT) {
                    for (let dx = 10; dx <= 15; dx++) {
                        const dist = 15 - dx;
                        const topY = (dist === 0) ? 1 : dist;
                        const botY = (dist === 0) ? 14 : (15 - dist);
                        for (let dy = topY + 1; dy < botY; dy++) setPixel(ox + dx, oy + dy, 0);
                        setPixel(ox + dx, oy + topY, 1);
                        setPixel(ox + dx, oy + botY, 1);
                    }
                } else if (dir === DIR_UP) {
                    for (let dy = 0; dy <= 5; dy++) {
                        const leftX = (dy === 0) ? 1 : dy;
                        const rightX = (dy === 0) ? 14 : (15 - dy);
                        for (let dx = leftX + 1; dx < rightX; dx++) setPixel(ox + dx, oy + dy, 0);
                        setPixel(ox + leftX, oy + dy, 1);
                        setPixel(ox + rightX, oy + dy, 1);
                    }
                } else if (dir === DIR_DOWN) {
                    for (let dy = 10; dy <= 15; dy++) {
                        const dist = 15 - dy;
                        const leftX = (dist === 0) ? 1 : dist;
                        const rightX = (dist === 0) ? 14 : (15 - dist);
                        for (let dx = leftX + 1; dx < rightX; dx++) setPixel(ox + dx, oy + dy, 0);
                        setPixel(ox + leftX, oy + dy, 1);
                        setPixel(ox + rightX, oy + dy, 1);
                    }
                }
            }

            // Helper to draw occupied black path fill for any sub-layer (1..4) or Ramp
            function drawOccupiedSubLayer(subLayer) {
                const sq = GetSquare(r, c, subLayer);
                if ((sq & 0x30) === 0) return;

                if (isRamp) {
                    const combinedNibs = (gNibMask[r][c][LAYER_WIDE_BASE] | gNibMask[r][c][LAYER_NARROW_BASE]) ||
                                         ((wBase | nBase) & 0x0F);

                    fillRectFB(ox + 7, oy + 7, 2, 2, 1);

                    for (let dir = 0; dir < 4; dir++) {
                        if (!(combinedNibs & (1 << dir))) continue;

                        if (wBaseOpen & (1 << dir)) {
                            if (dir === DIR_LEFT) {
                                for (let dx = 0; dx <= 7; dx++) {
                                    const fillTop = Math.min(7, 3 + dx);
                                    const fillBot = Math.max(8, 12 - dx);
                                    fillRectFB(ox + dx, oy + fillTop, 1, fillBot - fillTop + 1, 1);
                                }
                            } else if (dir === DIR_RIGHT) {
                                for (let dx = 8; dx <= 15; dx++) {
                                    const dist = 15 - dx;
                                    const fillTop = Math.min(7, 3 + dist);
                                    const fillBot = Math.max(8, 12 - dist);
                                    fillRectFB(ox + dx, oy + fillTop, 1, fillBot - fillTop + 1, 1);
                                }
                            } else if (dir === DIR_UP) {
                                for (let dy = 0; dy <= 7; dy++) {
                                    const fillLeft = Math.min(7, 3 + dy);
                                    const fillRight = Math.max(8, 12 - dy);
                                    fillRectFB(ox + fillLeft, oy + dy, fillRight - fillLeft + 1, 1, 1);
                                }
                            } else if (dir === DIR_DOWN) {
                                for (let dy = 8; dy <= 15; dy++) {
                                    const dist = 15 - dy;
                                    const fillLeft = Math.min(7, 3 + dist);
                                    const fillRight = Math.max(8, 12 - dist);
                                    fillRectFB(ox + fillLeft, oy + dy, fillRight - fillLeft + 1, 1, 1);
                                }
                            }
                        } else if (nBaseOpen & (1 << dir)) {
                            if (dir === DIR_LEFT)  fillRectFB(ox, oy + 7, 8, 2, 1);
                            if (dir === DIR_RIGHT) fillRectFB(ox + 8, oy + 7, 8, 2, 1);
                            if (dir === DIR_UP)    fillRectFB(ox + 7, oy, 2, 8, 1);
                            if (dir === DIR_DOWN)  fillRectFB(ox + 7, oy + 8, 2, 8, 1);
                        }
                    }
                    return;
                }

                const nibs = gNibMask[r][c][subLayer] || (sq & 0x0F);

                if (isWideSubLayer(subLayer)) {
                    // Wide path fill (10x10 core at 3..12 inside 12x12 white interior 2..13)
                    fillRectFB(ox + 3, oy + 3, 10, 10, 1);
                    if (nibs & (1 << DIR_LEFT))  fillRectFB(ox, oy + 3, 3, 10, 1);
                    if (nibs & (1 << DIR_RIGHT)) fillRectFB(ox + 13, oy + 3, 3, 10, 1);
                    if (nibs & (1 << DIR_UP))    fillRectFB(ox + 3, oy, 10, 3, 1);
                    if (nibs & (1 << DIR_DOWN))  fillRectFB(ox + 3, oy + 13, 10, 3, 1);
                } else {
                    // Narrow path fill (2x2 center line at 7..8 inside 4x4 narrow white interior 6..9)
                    fillRectFB(ox + 7, oy + 7, 2, 2, 1);
                    if (nibs & (1 << DIR_LEFT))  fillRectFB(ox, oy + 7, 7, 2, 1);
                    if (nibs & (1 << DIR_RIGHT)) fillRectFB(ox + 9, oy + 7, 7, 2, 1);
                    if (nibs & (1 << DIR_UP))    fillRectFB(ox + 7, oy, 2, 7, 1);
                    if (nibs & (1 << DIR_DOWN))  fillRectFB(ox + 7, oy + 9, 2, 7, 1);
                }
            }

            // =========================================================================
            // COMPOSITING PIPELINE (Bottom-to-Top, matching 68K DRAWSQUA):
            //   Pass 1: Wide Base (Sub-layer 1)
            //   Pass 2: Wide 90° Overpass Bridge (Sub-layer 2)
            //   Pass 3: Diagonal Ramp (if ISRAMP)
            //   Pass 4: Narrow Base (Sub-layer 3 - sits right on top of Wide paths!)
            //   Pass 5: Narrow 90° Overpass Bridge (Sub-layer 4 - sits on top of Narrow Base!)
            // =========================================================================

            if (!isRamp) {
                // Pass 1: Wide Base
                if (wBaseOpen !== 0) {
                    drawWideCorridor(wBaseOpen);
                    drawOccupiedSubLayer(LAYER_WIDE_BASE);
                    if (typeof drawSolutionDotsForCellLayer === 'function') drawSolutionDotsForCellLayer(r, c, LAYER_WIDE_BASE);
                }

                // Pass 2: Wide 90° Overpass Bridge
                if (wBridgeOpen !== 0) {
                    drawWideOverpass(wBridgeOpen);
                    drawOccupiedSubLayer(LAYER_WIDE_BRIDGE);
                    if (typeof drawSolutionDotsForCellLayer === 'function') drawSolutionDotsForCellLayer(r, c, LAYER_WIDE_BRIDGE);
                }
            } else {
                // Pass 3: 45° Diagonal Ramp transitioning Wide Base (1) <-> Narrow Base (3)
                fillRectFB(ox + 6, oy + 6, 4, 4, 0);

                for (let dir = 0; dir < 4; dir++) {
                    if (wBaseOpen & (1 << dir)) {
                        drawDiagonalFunnelStub(dir);
                    }
                }
                for (let dir = 0; dir < 4; dir++) {
                    if (nBaseOpen & (1 << dir)) {
                        if (dir === DIR_LEFT) {
                            fillRectFB(ox, oy + 6, 6, 4, 0);
                            fillRectFB(ox, oy + 5, 6, 1, 1);
                            fillRectFB(ox, oy + 10, 6, 1, 1);
                        } else if (dir === DIR_RIGHT) {
                            fillRectFB(ox + 10, oy + 6, 6, 4, 0);
                            fillRectFB(ox + 10, oy + 5, 6, 1, 1);
                            fillRectFB(ox + 10, oy + 10, 6, 1, 1);
                        } else if (dir === DIR_UP) {
                            fillRectFB(ox + 6, oy, 4, 6, 0);
                            fillRectFB(ox + 5, oy, 1, 6, 1);
                            fillRectFB(ox + 10, oy, 1, 6, 1);
                        } else if (dir === DIR_DOWN) {
                            fillRectFB(ox + 6, oy + 10, 4, 6, 0);
                            fillRectFB(ox + 5, oy + 10, 1, 6, 1);
                            fillRectFB(ox + 10, oy + 10, 1, 6, 1);
                        }
                    }
                }

                const allOpen = wBaseOpen | nBaseOpen;
                if (!(allOpen & (1 << DIR_LEFT)))  fillRectFB(ox + 5, oy + 5, 1, 6, 1);
                if (!(allOpen & (1 << DIR_RIGHT))) fillRectFB(ox + 10, oy + 5, 1, 6, 1);
                if (!(allOpen & (1 << DIR_UP)))    fillRectFB(ox + 5, oy + 5, 6, 1, 1);
                if (!(allOpen & (1 << DIR_DOWN)))  fillRectFB(ox + 5, oy + 10, 6, 1, 1);

                setPixel(ox + 5, oy + 5, 1);
                setPixel(ox + 10, oy + 5, 1);
                setPixel(ox + 5, oy + 10, 1);
                setPixel(ox + 10, oy + 10, 1);

                if ((wBase & 0x30) !== 0 || (nBase & 0x30) !== 0) {
                    drawOccupiedSubLayer((wBase & 0x30) !== 0 ? LAYER_WIDE_BASE : LAYER_NARROW_BASE);
                }
                if (typeof drawSolutionDotsForCellLayer === 'function') {
                    drawSolutionDotsForCellLayer(r, c, LAYER_WIDE_BASE);
                    drawSolutionDotsForCellLayer(r, c, LAYER_NARROW_BASE);
                }
            }

            // Pass 4 & 5: Narrow Upper Maze Plane (drawn right on top of the Wide Maze!)
            if (!isRamp) {
                if (nBaseOpen !== 0) {
                    drawNarrowCorridor(nBaseOpen);
                    drawOccupiedSubLayer(LAYER_NARROW_BASE);
                    if (typeof drawSolutionDotsForCellLayer === 'function') drawSolutionDotsForCellLayer(r, c, LAYER_NARROW_BASE);
                }
                if (nBridgeOpen !== 0) {
                    drawNarrowOverpass(nBridgeOpen);
                    drawOccupiedSubLayer(LAYER_NARROW_BRIDGE);
                    if (typeof drawSolutionDotsForCellLayer === 'function') drawSolutionDotsForCellLayer(r, c, LAYER_NARROW_BRIDGE);
                }
            }

            // Pass 6: MARKENDS: Start Circle (●) and End Goal Square (■)
            if (r === gEndPos.r && c === gEndPos.c) {
                const endOccupied = (GetSquare(r, c, gEndPos.layer) & 0x30) !== 0;
                const endColor = endOccupied ? 0 : 1;
                fillRectFB(ox + 4, oy + 4, 8, 8, endColor);
            }

            if (r === gStartPos.r && c === gStartPos.c) {
                const startOccupied = (GetSquare(r, c, gStartPos.layer) & 0x30) !== 0;
                const circleColor = startOccupied ? 0 : 1;
                const circleRows = [
                    0b00111100,
                    0b01111110,
                    0b11111111,
                    0b11111111,
                    0b11111111,
                    0b11111111,
                    0b01111110,
                    0b00111100
                ];
                for (let cy = 0; cy < 8; cy++) {
                    for (let cx = 0; cx < 8; cx++) {
                        if (circleRows[cy] & (0x80 >> cx)) {
                            setPixel(ox + 4 + cx, oy + 4 + cy, circleColor);
                        }
                    }
                }
            }
        }

        function RenderEntireMaze() {
            // Re-fill outer margins with 50% grey checkerboard
            fillGrayRectFB(0, 0, fbWidth, fbHeight);

            for (let r = 1; r <= gMaxRow; r++) {
                for (let c = 1; c <= gMaxCol; c++) {
                    DrawSquare(r, c);
                }
            }

            flushFramebufferToCanvas();
        }

        /* ============================================================================
         * 6. AUTHENTIC 2-PLANE (4-SUBLAYER) WEAVE MAZE GENERATOR (MAKEMAZE + NEIGHBOR)
         * ============================================================================
         * How the two Maze Planes work together:
         *   - PLANE 1 (Wide Lower Maze: `LAYER_WIDE_BASE` = 1, `LAYER_WIDE_BRIDGE` = 2):
         *       * Wide paths (`1`) can walk into any cell where Wide Base (`1`) is empty
         *         (and not a Ramp), EVEN IF Narrow paths (`3` or `4`) already exist above it!
         *       * Wide paths can cross perpendicular Wide paths (`1`) at 90° using
         *         `LAYER_WIDE_BRIDGE` (`2`).
         *   - PLANE 2 (Narrow Upper Maze: `LAYER_NARROW_BASE` = 3, `LAYER_NARROW_BRIDGE` = 4):
         *       * Narrow paths (`3`) sit in a completely separate maze layer ON TOP of Plane 1!
         *       * Narrow paths can walk into any cell where Narrow Base (`3`) is empty
         *         (and not a Ramp), directly on top of Wide paths (`1`) and Wide bridges (`2`)!
         *       * Narrow paths can cross perpendicular Narrow paths (`3`) at 90° using
         *         `LAYER_NARROW_BRIDGE` (`4`)!
         *       * Thus, a single cell `(r, c)` can contain up to 4 paths at once:
         *         Wide Base (`1`) + Wide Overpass (`2`) + Narrow Base (`3`) + Narrow Overpass (`4`)!
         *   - DIAGONAL RAMPS (`ISRAMP`):
         *       * Connect Plane 1 (`LAYER_WIDE_BASE`) and Plane 2 (`LAYER_NARROW_BASE`)
         *         on a cell where all 4 sub-layers are currently uncarved.
         */
        function MakeMaze(retryDepth = 0) {
            const cfg = SKILL_CONFIGS[gSkillLevel];
            gMaxRow = cfg.rows;
            gMaxCol = cfg.cols;

            const w = MARGIN_X * 2 + gMaxCol * TILE_STRIDE;
            const h = MARGIN_Y * 2 + gMaxRow * TILE_STRIDE;
            if (retryDepth === 0) initFramebuffer(w, h);

            allocateGrid(gMaxRow, gMaxCol);
            gGameWon = false;
            gShowingSolution = false;
            gSavedPreSolutionState = null;
            updateSolutionButtonUI();

            // Checks if a cell is completely empty on all 4 sub-layers (used when placing a Ramp)
            const isCellCompletelyEmpty = (r, c) =>
                r >= 1 && r <= gMaxRow && c >= 1 && c <= gMaxCol &&
                !IsRamp(r, c) &&
                GetSquare(r, c, LAYER_WIDE_BASE) === 0 &&
                GetSquare(r, c, LAYER_WIDE_BRIDGE) === 0 &&
                GetSquare(r, c, LAYER_NARROW_BASE) === 0 &&
                GetSquare(r, c, LAYER_NARROW_BRIDGE) === 0;

            // Checks if `baseLayer` (1 = Wide Base, 3 = Narrow Base) is free at `(r, c)`.
            // Notice that Wide Base (1) and Narrow Base (3) are COMPLETELY INDEPENDENT planes:
            // Narrow Base (3) can walk right on top of Wide Base (1) and Wide Bridge (2),
            // and Wide Base (1) can walk right underneath Narrow Base (3) and Narrow Bridge (4)!
            const isPlaneBaseFree = (r, c, baseLayer) => {
                if (r < 1 || r > gMaxRow || c < 1 || c > gMaxCol) return false;
                if (IsRamp(r, c)) return false;
                const bridgeLayer = bridgeLayerOfPlane(baseLayer);
                return GetSquare(r, c, baseLayer) === 0 && GetSquare(r, c, bridgeLayer) === 0;
            };

            // Helper: Find a 90° overpass bridge move on the SAME plane (`baseLayer` = 1 or 3)
            // Crossing 1, 2, or 3 parallel perpendicular corridors on `baseLayer` using `bridgeLayer` (2 or 4)
            function findSamePlaneBridgeMove(r, c, baseLayer, dir) {
                if (baseLayer === LAYER_WIDE_BASE && !cfg.allowWideBridges) return null;
                if (baseLayer === LAYER_NARROW_BASE && !cfg.allowNarrowBridges) return null;

                const bridgeLayer = bridgeLayerOfPlane(baseLayer);
                const mids = [];
                let cur = { r, c };

                for (let span = 1; span <= 3; span++) {
                    const mid = stepCoord(cur.r, cur.c, dir);
                    if (!IsBridge(mid.r, mid.c, baseLayer, dir)) {
                        break;
                    }
                    mids.push(mid);
                    const land = stepCoord(mid.r, mid.c, dir);
                    if (isPlaneBaseFree(land.r, land.c, baseLayer)) {
                        return {
                            mids: [...mids],
                            landR: land.r,
                            landC: land.c,
                            bridgeLayer,
                            landingLayer: baseLayer
                        };
                    }
                    cur = mid;
                }
                return null;
            }

            // Compute all valid `NEIGHBOR` moves from `(r, c, l)` where `l` is `LAYER_WIDE_BASE` (1) or `LAYER_NARROW_BASE` (3)
            function getAvailableMoves(r, c, l, lastDir, stepsOnCurrentPlane) {
                const otherPlaneBase = (l === LAYER_WIDE_BASE) ? LAYER_NARROW_BASE : LAYER_WIDE_BASE;
                const moves = [];
                const curIsRamp = IsRamp(r, c);
                const rampEntryMask = curIsRamp ? (GetSquare(r, c, otherPlaneBase) & 0x0F) : 0;

                const dirs = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
                for (const dir of dirs) {
                    if (curIsRamp && (rampEntryMask & (1 << dir)) !== 0) continue;

                    const next = stepCoord(r, c, dir);
                    const nr = next.r, nc = next.c;
                    if (nr < 1 || nr > gMaxRow || nc < 1 || nc > gMaxCol) continue;

                    // 1. Same-plane flat move (`LAYER_WIDE_BASE` or `LAYER_NARROW_BASE`)
                    //    Narrow paths (`LAYER_NARROW_BASE`) can go right on top of Wide paths below!
                    if (isPlaneBaseFree(nr, nc, l)) {
                        const turnBonus = (dir !== lastDir) ? 0.18 : 0;
                        // Slight bonus when Narrow path weaves over existing Wide paths below!
                        const weaveBonus = (l === LAYER_NARROW_BASE && GetSquare(nr, nc, LAYER_WIDE_BASE) !== 0) ? 0.25 : 0;
                        moves.push({
                            type: 'flat',
                            dir,
                            nr, nc,
                            nl: l,
                            priority: Math.random() + turnBonus + weaveBonus
                        });
                    }

                    // 2. Same-plane 90° Overpass Bridge (`LAYER_WIDE_BRIDGE` or `LAYER_NARROW_BRIDGE`)
                    //    Wide paths cross Wide paths at 90°; Narrow paths cross Narrow paths at 90°!
                    const br = findSamePlaneBridgeMove(r, c, l, dir);
                    if (br) {
                        const bridgeBoost = (Math.random() < cfg.bridgeChance) ? 1.35 : 0.40;
                        moves.push({
                            type: 'bridge',
                            dir,
                            mids: br.mids,
                            nr: br.landR,
                            nc: br.landC,
                            bridgeLayer: br.bridgeLayer,
                            nl: br.landingLayer,
                            priority: Math.random() + bridgeBoost
                        });
                    }

                    // 3. Diagonal Ramp transition between Wide Plane (1) and Narrow Plane (3)
                    //    Requires `(nr, nc)` to be completely empty on both planes so the 45° funnel is unobstructed
                    if (cfg.allowNarrowPlane && !curIsRamp &&
                        nr > 1 && nr < gMaxRow && nc > 1 && nc < gMaxCol &&
                        isCellCompletelyEmpty(nr, nc)) {

                        // Ensure the ramp has a valid exit on `otherPlaneBase`
                        let canExitRamp = false;
                        for (let ed = 0; ed < 4; ed++) {
                            if (ed === DirOpp(dir)) continue;
                            if (gSkillLevel === 2 && ed !== dir) continue;
                            const after = stepCoord(nr, nc, ed);
                            if (isPlaneBaseFree(after.r, after.c, otherPlaneBase) ||
                                findSamePlaneBridgeMove(nr, nc, otherPlaneBase, ed) !== null) {
                                canExitRamp = true;
                                break;
                            }
                        }

                        if (canExitRamp) {
                            const shouldRamp = (Math.random() < cfg.rampChance) ||
                                               (stepsOnCurrentPlane >= 5 && Math.random() < 0.45);
                            const rampBoost = shouldRamp ? 0.90 : -0.30;
                            moves.push({
                                type: 'ramp_step',
                                dir,
                                nr, nc,
                                nl: otherPlaneBase,
                                priority: Math.random() + rampBoost
                            });
                        }
                    }
                }

                return moves;
            }

            const activeNodes = [];
            const allCarvedNodes = [];

            // INITMAZE: Seed the initial cell on the Wide Lower Plane near a boundary edge
            const edgeChoice = Math.floor(Math.random() * 4);
            let seedR = 1, seedC = 1;
            if (edgeChoice === 0) {
                seedR = 1;
                seedC = Math.floor(Math.random() * (gMaxCol - 4)) + 3;
            } else if (edgeChoice === 1) {
                seedR = gMaxRow;
                seedC = Math.floor(Math.random() * (gMaxCol - 4)) + 3;
            } else if (edgeChoice === 2) {
                seedR = Math.floor(Math.random() * (gMaxRow - 4)) + 3;
                seedC = gMaxCol;
            } else {
                seedR = Math.floor(Math.random() * (gMaxRow - 4)) + 3;
                seedC = 1;
            }

            activeNodes.push({ r: seedR, c: seedC, l: LAYER_WIDE_BASE });
            allCarvedNodes.push({ r: seedR, c: seedC, l: LAYER_WIDE_BASE });

            const maxStepsPerBurst = (gSkillLevel === 0) ? 999 : (gSkillLevel === 1 ? 22 : 14);

            for (let walkIdx = 0; walkIdx < cfg.numWalks && activeNodes.length > 0; walkIdx++) {
                const pickIdx = Math.floor(Math.random() * activeNodes.length);
                const origin = activeNodes[pickIdx];

                let r = origin.r;
                let c = origin.c;
                let l = origin.l;

                if (IsRamp(r, c) &&
                    (GetSquare(r, c, LAYER_WIDE_BASE) & 0x0F) !== 0 &&
                    (GetSquare(r, c, LAYER_NARROW_BASE) & 0x0F) !== 0) {
                    activeNodes.splice(pickIdx, 1);
                    continue;
                }

                let lastDir = -1;
                let stepsOnCurrentPlane = 0;
                let burstSteps = 0;

                while (burstSteps < maxStepsPerBurst || IsRamp(r, c)) {
                    const moves = getAvailableMoves(r, c, l, lastDir, stepsOnCurrentPlane);

                    if (moves.length === 0) {
                        if (IsRamp(r, c) && (GetSquare(r, c, l) & 0x0F) === 0) {
                            PutSquare(r, c, LAYER_WIDE_BASE, GetSquare(r, c, LAYER_WIDE_BASE) & ~0x80);
                            PutSquare(r, c, LAYER_NARROW_BASE, GetSquare(r, c, LAYER_NARROW_BASE) & ~0x80);
                        }
                        const deadIdx = activeNodes.findIndex(n => n.r === r && n.c === c && n.l === l);
                        if (deadIdx !== -1) activeNodes.splice(deadIdx, 1);
                        break;
                    }

                    moves.sort((a, b) => b.priority - a.priority);
                    const pick = moves[0];
                    lastDir = pick.dir;
                    burstSteps++;

                    if (pick.type === 'flat') {
                        MarkSquare(r, c, l, pick.dir);
                        MarkSquare(pick.nr, pick.nc, pick.nl, DirOpp(pick.dir));
                        r = pick.nr;
                        c = pick.nc;
                        l = pick.nl;
                        stepsOnCurrentPlane++;
                        activeNodes.push({ r, c, l });
                        allCarvedNodes.push({ r, c, l });
                    } else if (pick.type === 'ramp_step') {
                        MarkSquare(r, c, l, pick.dir);
                        MarkSquare(pick.nr, pick.nc, l, DirOpp(pick.dir));
                        MarkSquare(pick.nr, pick.nc, LAYER_WIDE_BASE, 7);
                        MarkSquare(pick.nr, pick.nc, LAYER_NARROW_BASE, 7);
                        r = pick.nr;
                        c = pick.nc;
                        l = pick.nl;
                        stepsOnCurrentPlane = 0;
                    } else if (pick.type === 'bridge') {
                        MarkSquare(r, c, l, pick.dir);
                        for (const mid of pick.mids) {
                            MarkSquare(mid.r, mid.c, pick.bridgeLayer, DirOpp(pick.dir));
                            MarkSquare(mid.r, mid.c, pick.bridgeLayer, pick.dir);
                        }
                        MarkSquare(pick.nr, pick.nc, pick.nl, DirOpp(pick.dir));
                        r = pick.nr;
                        c = pick.nc;
                        l = pick.nl;
                        stepsOnCurrentPlane += pick.mids.length + 1;
                        activeNodes.push({ r, c, l });
                        allCarvedNodes.push({ r, c, l });
                    }
                }
            }

            // MARKENDS: Select two well-separated dead-ends on LAYER_WIDE_BASE (where no bridge or narrow path is on top)
            // so the Start Circle (●) and End Square (■) are always true dead ends and never under an overpass!
            function collectCleanWideDeadEnds() {
                const list = [];
                for (let r = 1; r <= gMaxRow; r++) {
                    for (let c = 1; c <= gMaxCol; c++) {
                        if (IsRamp(r, c)) continue;
                        if ((GetSquare(r, c, LAYER_WIDE_BRIDGE) & 0x0F) !== 0) continue;
                        if ((GetSquare(r, c, LAYER_NARROW_BASE) & 0x0F) !== 0) continue;
                        if ((GetSquare(r, c, LAYER_NARROW_BRIDGE) & 0x0F) !== 0) continue;
                        const mask = GetSquare(r, c, LAYER_WIDE_BASE) & 0x0F;
                        if (mask === 1 || mask === 2 || mask === 4 || mask === 8) {
                            const isBorder = (r === 1 || r === gMaxRow || c === 1 || c === gMaxCol);
                            list.push({ r, c, layer: LAYER_WIDE_BASE, isBorder });
                        }
                    }
                }
                return list;
            }

            let wideDeadEnds = collectCleanWideDeadEnds();

            // If dense bridges/ramps left fewer than 2 unobstructed dead ends, carve clean 1-cell dead-end spurs
            if (wideDeadEnds.length < 2) {
                const candidates = [];
                for (let r = 1; r <= gMaxRow; r++) {
                    for (let c = 1; c <= gMaxCol; c++) {
                        if (IsRamp(r, c)) continue;
                        if ((GetSquare(r, c, LAYER_WIDE_BASE) & 0x0F) === 0) continue;
                        for (let d = 0; d < 4; d++) {
                            const nb = stepCoord(r, c, d);
                            if (isCellCompletelyEmpty(nb.r, nb.c)) {
                                candidates.push({ r, c, d, nr: nb.r, nc: nb.c });
                            }
                        }
                    }
                }
                while (wideDeadEnds.length < 2 && candidates.length > 0) {
                    const idx = Math.floor(Math.random() * candidates.length);
                    const pick = candidates.splice(idx, 1)[0];
                    if (!isCellCompletelyEmpty(pick.nr, pick.nc)) continue;
                    MarkSquare(pick.r, pick.c, LAYER_WIDE_BASE, pick.d);
                    MarkSquare(pick.nr, pick.nc, LAYER_WIDE_BASE, DirOpp(pick.d));
                    wideDeadEnds = collectCleanWideDeadEnds();
                }
            }

            function computeMoveDistancesFrom(origin) {
                const distMap = new Map();
                const startKey = `${origin.r},${origin.c},${origin.layer}`;
                distMap.set(startKey, 0);
                const q = [{ r: origin.r, c: origin.c, layer: origin.layer, d: 0 }];
                let head = 0;
                while (head < q.length) {
                    const cur = q[head++];
                    for (let dir = 0; dir < 4; dir++) {
                        const step = canMove(cur.r, cur.c, cur.layer, dir);
                        if (!step) continue;
                        const k = `${step.r},${step.c},${step.layer}`;
                        if (!distMap.has(k)) {
                            distMap.set(k, cur.d + 1);
                            q.push({ r: step.r, c: step.c, layer: step.layer, d: cur.d + 1 });
                        }
                    }
                }
                return distMap;
            }

            const minMult = (gSkillLevel === 3) ? 1.05 : 0.85;
            const minSolutionMoves = Math.max(12, Math.floor((gMaxRow + gMaxCol) * minMult));

            if (wideDeadEnds.length >= 2) {
                // Evaluate pairs of clean dead ends by actual shortest-path maze moves
                const longPairs = [];
                let bestPair = null;
                let bestMoves = -1;

                for (let i = 0; i < wideDeadEnds.length; i++) {
                    const a = wideDeadEnds[i];
                    const distMap = computeMoveDistancesFrom(a);
                    for (let j = i + 1; j < wideDeadEnds.length; j++) {
                        const b = wideDeadEnds[j];
                        const moves = distMap.get(`${b.r},${b.c},${b.layer}`);
                        if (moves === undefined) continue;
                        const score = moves + (a.isBorder ? 4 : 0) + (b.isBorder ? 4 : 0);
                        if (moves > bestMoves || (moves === bestMoves && bestPair && score > bestPair.score)) {
                            bestMoves = moves;
                            bestPair = { a, b, moves, score };
                        }
                        if (moves >= minSolutionMoves) {
                            longPairs.push({ a, b, moves, score });
                        }
                    }
                }

                if (longPairs.length === 0 && retryDepth < 20) {
                    MakeMaze(retryDepth + 1);
                    return;
                }

                let chosen = bestPair;
                if (longPairs.length > 0) {
                    // Pick randomly among the longest ~35% of valid pairs for variety without short solutions
                    longPairs.sort((p, q) => q.score - p.score);
                    const topCount = Math.max(1, Math.ceil(longPairs.length * 0.35));
                    chosen = longPairs[Math.floor(Math.random() * topCount)];
                }

                if (chosen) {
                    const flip = Math.random() < 0.5;
                    const sNode = flip ? chosen.b : chosen.a;
                    const eNode = flip ? chosen.a : chosen.b;
                    gStartPos = { r: sNode.r, c: sNode.c, layer: LAYER_WIDE_BASE };
                    gEndPos = { r: eNode.r, c: eNode.c, layer: LAYER_WIDE_BASE };
                } else {
                    gStartPos = { r: wideDeadEnds[0].r, c: wideDeadEnds[0].c, layer: LAYER_WIDE_BASE };
                    gEndPos = { r: wideDeadEnds[1].r, c: wideDeadEnds[1].c, layer: LAYER_WIDE_BASE };
                }
            } else if (retryDepth < 20) {
                MakeMaze(retryDepth + 1);
                return;
            } else {
                // Ultimate fallback: pick only unobstructed wide cells without bridges
                const cleanWide = [];
                for (let r = 1; r <= gMaxRow; r++) {
                    for (let c = 1; c <= gMaxCol; c++) {
                        if (!IsRamp(r, c) &&
                            (GetSquare(r, c, LAYER_WIDE_BASE) & 0x0F) !== 0 &&
                            (GetSquare(r, c, LAYER_WIDE_BRIDGE) & 0x0F) === 0 &&
                            (GetSquare(r, c, LAYER_NARROW_BASE) & 0x0F) === 0 &&
                            (GetSquare(r, c, LAYER_NARROW_BRIDGE) & 0x0F) === 0) {
                            cleanWide.push({ r, c, layer: LAYER_WIDE_BASE });
                        }
                    }
                }
                gStartPos = cleanWide.length > 0 ? cleanWide[0] : { r: seedR, c: seedC, layer: LAYER_WIDE_BASE };
                gEndPos = cleanWide.length > 1 ? cleanWide[cleanWide.length - 1] : { r: seedR, c: seedC, layer: LAYER_WIDE_BASE };
            }

            gPlayer = { ...gStartPos };
            gPathHistory = [{ ...gStartPos }];

            document.getElementById('statusText').textContent = 'DRAG ● TO ■';
            updateLayerIndicator();
            RenderEntireMaze();
        }

        /* ============================================================================
         * 7. MOVEMENT ENGINE Across All 4 Sub-Layers (Wide Base/Bridge & Narrow Base/Bridge)
         * ============================================================================ */

        function canMove(r, c, layer, dir) {
            const next = stepCoord(r, c, dir);
            if (next.r < 1 || next.r > gMaxRow || next.c < 1 || next.c > gMaxCol) return null;
            const oppDir = DirOpp(dir);

            const baseL   = baseLayerOfPlane(layer);
            const bridgeL = bridgeLayerOfPlane(layer);
            const otherPlaneBase = (baseL === LAYER_WIDE_BASE) ? LAYER_NARROW_BASE : LAYER_WIDE_BASE;

            // 1. Determine which sub-layer exits `(r, c)` in direction `dir`
            let exitSubLayer = 0;
            if (MemberOf(dir, r, c, layer)) {
                exitSubLayer = layer;
            } else if (IsRamp(r, c) && MemberOf(dir, r, c, otherPlaneBase)) {
                exitSubLayer = otherPlaneBase;
            } else {
                return null;
            }

            const exitPlaneBase   = baseLayerOfPlane(exitSubLayer);
            const exitPlaneBridge = bridgeLayerOfPlane(exitSubLayer);

            // 2. Check if `(next.r, next.c)` accepts entry on the same plane's Base layer (`1` or `3`)
            if (MemberOf(oppDir, next.r, next.c, exitPlaneBase)) {
                let landedLayer = exitPlaneBase;
                if (IsRamp(next.r, next.c)) {
                    const rampTargetBase = (exitPlaneBase === LAYER_WIDE_BASE) ? LAYER_NARROW_BASE : LAYER_WIDE_BASE;
                    if ((GetSquare(next.r, next.c, rampTargetBase) & 0x0F) !== 0) {
                        landedLayer = rampTargetBase;
                    }
                }
                return { r: next.r, c: next.c, layer: landedLayer, entryLayer: exitPlaneBase };
            }

            // 3. Check if `(next.r, next.c)` accepts entry onto a 90° Overpass Bridge on the same plane (`2` or `4`)
            if (!IsRamp(next.r, next.c) && MemberOf(oppDir, next.r, next.c, exitPlaneBridge)) {
                return { r: next.r, c: next.c, layer: exitPlaneBridge, entryLayer: exitPlaneBridge };
            }

            return null;
        }

        function markStepNibs(fromR, fromC, fromLayer, dir, stepInfo, flagBit) {
            const otherPlaneBase = (baseLayerOfPlane(fromLayer) === LAYER_WIDE_BASE) ? LAYER_NARROW_BASE : LAYER_WIDE_BASE;
            const outLayer = MemberOf(dir, fromR, fromC, fromLayer) ? fromLayer : otherPlaneBase;

            MarkSquare(fromR, fromC, outLayer, flagBit);
            gNibMask[fromR][fromC][outLayer] |= (1 << dir);
            if (IsRamp(fromR, fromC)) {
                MarkSquare(fromR, fromC, LAYER_WIDE_BASE, flagBit);
                MarkSquare(fromR, fromC, LAYER_NARROW_BASE, flagBit);
            }

            const inLayer = stepInfo.entryLayer;
            MarkSquare(stepInfo.r, stepInfo.c, inLayer, flagBit);
            gNibMask[stepInfo.r][stepInfo.c][inLayer] |= (1 << DirOpp(dir));
            if (IsRamp(stepInfo.r, stepInfo.c)) {
                MarkSquare(stepInfo.r, stepInfo.c, LAYER_WIDE_BASE, flagBit);
                MarkSquare(stepInfo.r, stepInfo.c, LAYER_NARROW_BASE, flagBit);
            }
        }

        // Recomputes all occupied flags (0x10 / 0x20) and directional nib masks across all 4 sub-layers
        function syncGridWithPathHistory(flagBit = 4) {
            for (let r = 1; r <= gMaxRow; r++) {
                for (let c = 1; c <= gMaxCol; c++) {
                    for (let l = 1; l <= 4; l++) {
                        gMaze[r][c][l] &= ~0x30;
                        gNibMask[r][c][l] = 0;
                    }
                }
            }

            for (let i = 0; i < gPathHistory.length - 1; i++) {
                const curr = gPathHistory[i];
                const next = gPathHistory[i + 1];
                let dir = -1;
                if (next.c === curr.c - 1) dir = DIR_LEFT;
                else if (next.r === curr.r + 1) dir = DIR_DOWN;
                else if (next.c === curr.c + 1) dir = DIR_RIGHT;
                else if (next.r === curr.r - 1) dir = DIR_UP;

                if (dir !== -1) {
                    const step = canMove(curr.r, curr.c, curr.layer, dir);
                    if (step) {
                        markStepNibs(curr.r, curr.c, curr.layer, dir, step, flagBit);
                    }
                }
            }
        }

        function movePlayerDir(dir) {
            if (gGameWon) return false;
            const step = canMove(gPlayer.r, gPlayer.c, gPlayer.layer, dir);
            if (!step) return false;

            const prev = { ...gPlayer };
            gShowingSolution = false;

            // Check if player is backtracking to the previous square on their path
            if (gPathHistory.length >= 2) {
                const prevHist = gPathHistory[gPathHistory.length - 2];
                if (prevHist.r === step.r && prevHist.c === step.c && prevHist.layer === step.layer) {
                    gPathHistory.pop();
                    gPlayer = { ...prevHist };
                    syncGridWithPathHistory(4);

                    DrawSquare(prev.r, prev.c);
                    DrawSquare(gPlayer.r, gPlayer.c);
                    flushFramebufferToCanvas();
                    updateLayerIndicator();
                    return true;
                }
            }

            // Prevent self-intersecting loops if dragging back into an earlier visited cell on the same layer
            const existingIdx = gPathHistory.findIndex(
                p => p.r === step.r && p.c === step.c && p.layer === step.layer
            );
            if (existingIdx !== -1) {
                // Truncate path back to that earlier point
                gPathHistory.length = existingIdx + 1;
                gPlayer = { ...gPathHistory[gPathHistory.length - 1] };
                gSavedPreSolutionState = null;
                updateSolutionButtonUI();
                syncGridWithPathHistory(4);
                RenderEntireMaze();
                updateLayerIndicator();
                return true;
            }

            gPlayer = { r: step.r, c: step.c, layer: step.layer };
            gPathHistory.push({ ...gPlayer });
            gSavedPreSolutionState = null;
            updateSolutionButtonUI();
            syncGridWithPathHistory(4);

            DrawSquare(prev.r, prev.c);
            DrawSquare(gPlayer.r, gPlayer.c);
            flushFramebufferToCanvas();
            updateLayerIndicator();

            if (gPlayer.r === gEndPos.r && gPlayer.c === gEndPos.c && gPlayer.layer === gEndPos.layer) {
                triggerWin();
            }
            return true;
        }

        function SolveMaze() {
            // If Solution is already showing, toggle it OFF and restore where the player left off!
            if (gShowingSolution && gSavedPreSolutionState) {
                gPathHistory = gSavedPreSolutionState.pathHistory.map(p => ({ ...p }));
                gPlayer = { ...gSavedPreSolutionState.player };
                gGameWon = gSavedPreSolutionState.gameWon;
                gShowingSolution = false;
                gSavedPreSolutionState = null;

                updateSolutionButtonUI();
                syncGridWithPathHistory(4);
                updateLayerIndicator();
                RenderEntireMaze();
                document.getElementById('statusText').textContent = 'RESUMED';
                return;
            }

            // Save current player path & position before displaying solution
            gSavedPreSolutionState = {
                pathHistory: gPathHistory.map(p => ({ ...p })),
                player: { ...gPlayer },
                gameWon: gGameWon
            };

            const visited = new Set();
            const steps = [];

            function dfs(r, c, layer) {
                const key = `${r},${c},${layer}`;
                if (visited.has(key)) return false;
                visited.add(key);

                if (r === gEndPos.r && c === gEndPos.c && layer === gEndPos.layer) {
                    return true;
                }

                for (let dir = 0; dir < 4; dir++) {
                    const step = canMove(r, c, layer, dir);
                    if (step) {
                        if (dfs(step.r, step.c, step.layer)) {
                            steps.push({ r, c, layer, dir, step });
                            return true;
                        }
                    }
                }
                return false;
            }

            dfs(gStartPos.r, gStartPos.c, gStartPos.layer);
            steps.reverse();

            // Display solved path
            gPathHistory = [{ ...gStartPos }];
            for (const node of steps) {
                gPathHistory.push({ r: node.step.r, c: node.step.c, layer: node.step.layer });
            }
            gPlayer = { ...gPathHistory[gPathHistory.length - 1] };
            gGameWon = false;
            gShowingSolution = true;

            updateSolutionButtonUI();
            syncGridWithPathHistory(5);
            updateLayerIndicator();
            RenderEntireMaze();
            document.getElementById('statusText').textContent = 'SOLUTION SHOWN';
        }

        let isDragging = false;

        function handlePointerAt(clientX, clientY) {
            if (gGameWon) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            const targetC = Math.floor((x - MARGIN_X) / TILE_STRIDE) + 1;
            const targetR = Math.floor((y - MARGIN_Y) / TILE_STRIDE) + 1;

            if (targetR < 1 || targetR > gMaxRow || targetC < 1 || targetC > gMaxCol) return;
            if (targetR === gPlayer.r && targetC === gPlayer.c) return;

            const dr = targetR - gPlayer.r;
            const dc = targetC - gPlayer.c;
            if (Math.abs(dr) + Math.abs(dc) === 1) {
                let dir = -1;
                if (dc === -1) dir = DIR_LEFT;
                else if (dr === 1) dir = DIR_DOWN;
                else if (dc === 1) dir = DIR_RIGHT;
                else if (dr === -1) dir = DIR_UP;
                if (dir !== -1) movePlayerDir(dir);
            } else if (Math.abs(dr) + Math.abs(dc) <= 3 && (dr === 0 || dc === 0)) {
                // Smooth multi-cell drag along straight corridors and over bridges
                let dir = -1;
                if (dc < 0) dir = DIR_LEFT;
                else if (dr > 0) dir = DIR_DOWN;
                else if (dc > 0) dir = DIR_RIGHT;
                else if (dr < 0) dir = DIR_UP;
                const steps = Math.abs(dr) + Math.abs(dc);
                for (let s = 0; s < steps; s++) {
                    if (!movePlayerDir(dir)) break;
                }
            }
        }
