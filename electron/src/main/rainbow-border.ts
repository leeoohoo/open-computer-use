import { BrowserWindow, screen } from 'electron'

let borderWindow: BrowserWindow | null = null
let visible = false
let loaded: Promise<void> = Promise.resolve()

export function initRainbowBorder(): void {
  if (borderWindow && !borderWindow.isDestroyed()) return
  createWindow()
}

export async function showRainbowBorder(): Promise<void> {
  if (visible) return
  visible = true

  if (!borderWindow || borderWindow.isDestroyed()) {
    createWindow()
  }
  await loaded

  const win = borderWindow!
  if (win.isDestroyed()) return

  const { x, y, width, height } = screen.getPrimaryDisplay().bounds
  win.setBounds({ x, y, width, height })
  win.showInactive()
  win.webContents.executeJavaScript('fadeIn()').catch(() => {})
}

export function hideRainbowBorder(): void {
  if (!visible) return
  visible = false

  if (!borderWindow || borderWindow.isDestroyed()) return
  borderWindow.hide()
}

export function hideRainbowForScreenshot(): void {
  if (!borderWindow || borderWindow.isDestroyed() || !borderWindow.isVisible()) return
  borderWindow.hide()
}

export function showRainbowAfterScreenshot(): void {
  if (!visible || !borderWindow || borderWindow.isDestroyed()) return
  borderWindow.showInactive()
}

export function destroyRainbowBorder(): void {
  if (borderWindow && !borderWindow.isDestroyed()) {
    borderWindow.destroy()
  }
  borderWindow = null
  visible = false
  loaded = Promise.resolve()
}

function createWindow(): void {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds

  borderWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    thickFrame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    roundedCorners: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  borderWindow.setIgnoreMouseEvents(true)

  if (process.platform !== 'win32') {
    borderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  loaded = new Promise<void>((resolve) => {
    borderWindow!.once('ready-to-show', () => resolve())
  })

  borderWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(GLOW_HTML)}`)

  borderWindow.on('closed', () => {
    borderWindow = null
    visible = false
    loaded = Promise.resolve()
  })
}

// ── HTML / Canvas ──────────────────────────────────────────────────
//
// Organic rainbow aura using canvas with soft radial-gradient blobs
// that orbit the screen perimeter at different speeds and directions.
//
// Key techniques:
//  - 14 blobs with independent speed, direction, wobble, pulse, and hue
//  - Additive blending ('lighter') for rich aurora-like color mixing
//  - Half-resolution canvas → browser upscale = free natural softness
//  - Blob centers placed slightly outside the viewport so glow bleeds inward
//  - Subtle global "breathing" (±10% intensity oscillation)
//  - Some blobs clockwise, some counter-clockwise → crossing patterns
//  - Varied radii (120–350px) for depth: large faint wash + small bright accents
//
const GLOW_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
  *{margin:0;padding:0}
  html,body{width:100vw;height:100vh;overflow:hidden;background:transparent}
  #wrap{position:fixed;inset:0;opacity:0;transition:opacity .4s ease-out}
  #wrap.on{opacity:1}
  canvas{width:100vw;height:100vh;display:block}
</style>
</head>
<body>
<div id="wrap"><canvas id="c"></canvas></div>
<script>
(function(){
  var wrap = document.getElementById('wrap');
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');

  // Render at half resolution — upscale gives free softness
  var W, H;
  function resize() {
    W = Math.ceil(window.innerWidth / 2);
    H = Math.ceil(window.innerHeight / 2);
    canvas.width = W;
    canvas.height = H;
  }
  resize();
  window.addEventListener('resize', resize);

  // Deterministic pseudo-random per blob index
  function sr(i) {
    return ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
  }

  var NUM = 14;
  var blobs = [];
  for (var i = 0; i < NUM; i++) {
    var r1 = sr(i), r2 = sr(i+97), r3 = sr(i+199), r4 = sr(i+307);
    blobs.push({
      baseT: i / NUM,
      // Different speeds, some clockwise (positive) some counter-clockwise
      speed: (0.012 + r1 * 0.022) * (r2 > 0.5 ? 1 : -1),
      wobbleAmp: 0.008 + r3 * 0.025,
      wobbleFreq: 0.25 + r4 * 0.55,
      // Varied radii: some large ambient, some small bright
      radius: (60 + r1 * 115),  // in half-res pixels (120-350 in screen px)
      pulseFreq: 0.25 + r2 * 0.6,
      pulseAmp: 0.15 + r3 * 0.1,
      alpha: 0.07 + r4 * 0.16,
      hueBase: (i / NUM) * 360,
    });
  }

  // Convert perimeter parameter t ∈ [0,1] to (x,y) in half-res coords.
  // Offset pushes blob center outside the viewport edge.
  var OFFSET = 10; // half-res pixels (20 screen px)
  function perimPt(t) {
    t = ((t % 1) + 1) % 1;
    var P = 2 * (W + H);
    var d = t * P;
    if (d < W)          return { x: d,               y: -OFFSET };
    if (d < W + H)      return { x: W + OFFSET,      y: d - W };
    if (d < 2 * W + H)  return { x: W - (d - W - H), y: H + OFFSET };
    return                      { x: -OFFSET,          y: H - (d - 2*W - H) };
  }

  var running = false;
  var lastTs = 0;

  function frame(ts) {
    if (!running) return;
    var time = ts / 1000;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // Subtle breathing: global intensity oscillation
    var breathe = 0.88 + 0.12 * Math.sin(time * 1.1);

    for (var i = 0; i < NUM; i++) {
      var b = blobs[i];
      var t = b.baseT + b.speed * time
            + Math.sin(time * b.wobbleFreq) * b.wobbleAmp
            + Math.sin(time * b.wobbleFreq * 0.7 + 2.0) * b.wobbleAmp * 0.5;
      var p = perimPt(t);
      var r = b.radius * (1 + b.pulseAmp * Math.sin(time * b.pulseFreq));

      // Slow global hue rotation so colors drift over time
      var hue = (b.hueBase + time * 6) % 360;
      var a = b.alpha * breathe;

      var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0,   'hsla(' + hue + ',78%,62%,' + (a).toFixed(3) + ')');
      grad.addColorStop(0.35,'hsla(' + hue + ',72%,56%,' + (a * 0.6).toFixed(3) + ')');
      grad.addColorStop(0.7, 'hsla(' + hue + ',65%,52%,' + (a * 0.2).toFixed(3) + ')');
      grad.addColorStop(1,   'hsla(' + hue + ',60%,48%,0)');

      ctx.fillStyle = grad;
      // Only fill the region this blob covers (perf optimisation)
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }

    requestAnimationFrame(frame);
  }

  window.fadeIn = function() {
    wrap.classList.add('on');
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  };
  window.fadeOut = function() {
    wrap.classList.remove('on');
    setTimeout(function() {
      if (!wrap.classList.contains('on')) running = false;
    }, 500);
  };
})();
</script>
</body>
</html>`
