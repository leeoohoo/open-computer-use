import { BrowserWindow, screen } from 'electron'
import { contentProtectionReliable, getMainWindow } from './window-manager'
import { getActiveDisplay } from './display-manager'

let borderWindow: BrowserWindow | null = null
let visible = false
let loaded: Promise<void> = Promise.resolve()
// 'full' = task-running intensity, 'ambient' = lighter expanded-overlay glow
let currentIntensity: 'full' | 'ambient' = 'full'
// Last-known origin in display-local coordinates (full-res screen px)
let lastOrigin: { x: number; y: number } | null = null

/**
 * Force the main overlay back on top of the rainbow.
 *
 * On Windows, both 'screen-saver' and 'floating' translate to the same
 * HWND_TOPMOST flag — there's no level hierarchy among topmost windows.
 * Z-order between two topmost windows is determined by which was raised
 * last via SetWindowPos. So whenever the rainbow's z-order changes
 * (showInactive, setAlwaysOnTop, fade-in), the rainbow may briefly land
 * above the pill; we instantly re-raise the pill to force it back on
 * top before the user sees a single repaint.
 *
 * Retried at +0ms / +33ms / +120ms / +280ms to cover any OS-level delay
 * in the rainbow's TOPMOST insertion settling. The main overlay's own
 * 2-second periodic enforcer catches anything later.
 */
function reassertMainAboveRainbow(): void {
  const apply = () => {
    const main = getMainWindow()
    if (!main || main.isDestroyed()) return
    try {
      main.setAlwaysOnTop(true, 'screen-saver', 1)
      main.moveTop()
    } catch {
      // Main may be transitioning — the periodic enforcer will catch up
    }
  }
  apply()
  setImmediate(apply)
  setTimeout(apply, 120)
  setTimeout(apply, 280)
}

export function initRainbowBorder(): void {
  if (borderWindow && !borderWindow.isDestroyed()) return
  createWindow()
}

/** Show at full intensity (task running). */
export async function showRainbowBorder(): Promise<void> {
  currentIntensity = 'full'
  await showWithIntensity('full')
}

/** Show a lighter ambient glow (overlay expanded). */
export async function showAmbientRainbow(): Promise<void> {
  if (visible && currentIntensity === 'full') return
  currentIntensity = 'ambient'
  await showWithIntensity('ambient')
}

async function showWithIntensity(intensity: 'full' | 'ambient'): Promise<void> {
  if (!borderWindow || borderWindow.isDestroyed()) {
    createWindow()
  }
  await loaded

  const win = borderWindow!
  if (win.isDestroyed()) return

  const { x, y, width, height } = getActiveDisplay().bounds
  win.setBounds({ x, y, width, height })

  const opacityVal = intensity === 'ambient' ? 0.15 : 1.0
  win.webContents.executeJavaScript(`setIntensity(${JSON.stringify(opacityVal)})`).catch(() => {})

  // Re-assert the origin so particles spawn from the right spot. If we don't
  // have one yet (cold start), default to top-center.
  if (lastOrigin) {
    pushOrigin(lastOrigin.x, lastOrigin.y)
  } else {
    pushOrigin(width / 2, 44)
  }

  if (!visible) {
    visible = true
    win.showInactive()
    // 'floating' is the structural-hierarchy choice (works on macOS where
    // window levels are real). On Windows both 'screen-saver' and
    // 'floating' map to HWND_TOPMOST, so we IMMEDIATELY re-raise the main
    // overlay below — that's the actual mechanism that keeps the pill on
    // top on Windows.
    win.setAlwaysOnTop(true, 'floating', 0)
    win.webContents.executeJavaScript('fadeIn()').catch(() => {})
    reassertMainAboveRainbow()
  }
}

/**
 * Update the origin point (full-res, display-local px) where particles
 * emanate from. Window-manager calls this whenever the pill moves so the
 * dispersion always tracks the pill's current location.
 */
export function setRainbowOrigin(localX: number, localY: number): void {
  lastOrigin = { x: localX, y: localY }
  pushOrigin(localX, localY)
}

function pushOrigin(localX: number, localY: number): void {
  if (!borderWindow || borderWindow.isDestroyed()) return
  // Canvas renders at half-resolution.
  const cx = localX / 2
  const cy = localY / 2
  borderWindow.webContents
    .executeJavaScript(`setOrigin(${cx.toFixed(1)}, ${cy.toFixed(1)})`)
    .catch(() => {})
}

export function hideRainbowBorder(): void {
  if (!visible) return
  visible = false
  currentIntensity = 'full'

  if (!borderWindow || borderWindow.isDestroyed()) return
  borderWindow.hide()
}

export function hideAmbientRainbow(): void {
  if (!visible || currentIntensity === 'full') return
  visible = false
  currentIntensity = 'full'

  if (!borderWindow || borderWindow.isDestroyed()) return
  borderWindow.hide()
}

export function hideRainbowForScreenshot(): void {
  if (!borderWindow || borderWindow.isDestroyed() || !borderWindow.isVisible()) return
  borderWindow.setOpacity(0)
}

export function showRainbowAfterScreenshot(): void {
  if (!visible || !borderWindow || borderWindow.isDestroyed()) return
  // 'floating' so the rainbow stays below the main overlay's 'screen-saver'.
  borderWindow.setAlwaysOnTop(true, 'floating', 0)
  // Re-raise the main overlay so the rainbow's restored z-order can't
  // briefly land above the pill on Windows.
  reassertMainAboveRainbow()

  const win = borderWindow
  const DURATION = 300
  const STEP = 16
  const steps = Math.ceil(DURATION / STEP)
  let step = 0
  const timer = setInterval(() => {
    step++
    if (!win || win.isDestroyed()) { clearInterval(timer); return }
    const t = Math.min(step / steps, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    win.setOpacity(eased)
    if (t >= 1) clearInterval(timer)
  }, STEP)
}

export function moveRainbowToDisplay(display: Electron.Display): void {
  if (!borderWindow || borderWindow.isDestroyed()) return
  const { x, y, width, height } = display.bounds
  borderWindow.setBounds({ x, y, width, height })
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
  const { x, y, width, height } = getActiveDisplay().bounds

  borderWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    thickFrame: false,
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

  // Use 'floating' level — above normal apps but BELOW the main overlay
  // ('screen-saver'). Keeps the pill consistently on top of the rainbow.
  borderWindow.setAlwaysOnTop(true, 'floating', 0)
  borderWindow.setIgnoreMouseEvents(true)

  if (contentProtectionReliable) {
    borderWindow.setContentProtection(true)
  }

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
// Particle dispersion emanating from the pill. Particles spawn at the
// pill's screen position and drift outward in random radial directions,
// fading in then out across a 4–7 second life. Subtle alpha + density
// keep the rainbow reading as a soft halo, not a firework. Origin
// tracked via setOrigin(x, y) so the dispersion follows the pill.
//
const GLOW_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
  *{margin:0;padding:0}
  html,body{width:100vw;height:100vh;overflow:hidden;background:transparent}
  #wrap{position:fixed;inset:0;opacity:0;transition:opacity .6s ease-out}
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

  var W, H;
  function resize() {
    W = Math.ceil(window.innerWidth / 2);
    H = Math.ceil(window.innerHeight / 2);
    canvas.width = W;
    canvas.height = H;
  }
  resize();
  window.addEventListener('resize', resize);

  // Origin where particles spawn (half-res coords). Default: top-center.
  var originX = W / 2;
  var originY = 22;
  window.setOrigin = function(x, y) {
    originX = x;
    originY = y;
  };

  var intensity = 1.0;
  window.setIntensity = function(v) { intensity = v; };

  var hueRotor = 0;
  var particles = [];
  // Tuned smaller + dimmer per user feedback. Each knob does one job:
  //   SPAWN_PER_SEC ↓ — fewer particles in flight = less compounded brightness
  //   radius range  ↓ — smaller blobs = visible halo stays closer to the pill
  //   alphaPeak     ↓ — each particle peaks at ~half its previous brightness
  var SPAWN_PER_SEC = 8;
  var spawnAccum = 0;

  function spawn() {
    var angle = Math.random() * Math.PI * 2;
    var speed = 20 + Math.random() * 42;     // half-res px/sec (was 22+50)
    var radius = 55 + Math.random() * 80;    // half-res blob radius (was 75+110)
    var maxLife = 3.6 + Math.random() * 3.0; // 3.6–6.6s (was 4.0–7.5)
    hueRotor = (hueRotor + 14 + Math.random() * 6) % 360;
    var hueShift = (Math.random() - 0.5) * 50;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      hue: hueRotor,
      hue2: (hueRotor + hueShift + 360) % 360,
      alphaPeak: 0.08 + Math.random() * 0.06, // dim halo (was 0.14+0.08)
      life: 0,
      maxLife: maxLife,
    });
  }

  function step(p, dt) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life += dt;
  }

  function envelope(t) {
    if (t < 0.35) return Math.sin((t / 0.35) * Math.PI * 0.5);
    return Math.sin(((1 - t) / 0.65) * Math.PI * 0.5);
  }

  function draw(p) {
    var t = p.life / p.maxLife;
    var alpha = p.alphaPeak * envelope(t) * intensity;
    if (alpha <= 0.001) return;
    var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grad.addColorStop(0,    'hsla(' + p.hue  + ',92%,68%,' + alpha.toFixed(3) + ')');
    grad.addColorStop(0.25, 'hsla(' + p.hue  + ',88%,62%,' + (alpha * 0.7).toFixed(3) + ')');
    grad.addColorStop(0.55, 'hsla(' + p.hue2 + ',82%,56%,' + (alpha * 0.32).toFixed(3) + ')');
    grad.addColorStop(0.82, 'hsla(' + p.hue2 + ',74%,50%,' + (alpha * 0.08).toFixed(3) + ')');
    grad.addColorStop(1,    'hsla(' + p.hue2 + ',65%,46%,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }

  function isCulled(p) {
    if (p.life >= p.maxLife) return true;
    var margin = p.r;
    if (p.x < -margin || p.x > W + margin || p.y < -margin || p.y > H + margin) {
      return p.life > p.maxLife * 0.4;
    }
    return false;
  }

  var running = false;
  var lastTs = 0;

  function frame(ts) {
    if (!running) return;
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;

    spawnAccum += dt * SPAWN_PER_SEC * Math.max(0.25, intensity);
    while (spawnAccum >= 1) {
      spawnAccum -= 1;
      spawn();
    }

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      step(p, dt);
      if (isCulled(p)) {
        particles.splice(i, 1);
      } else {
        draw(p);
      }
    }

    requestAnimationFrame(frame);
  }

  window.fadeIn = function() {
    wrap.classList.add('on');
    if (!running) {
      running = true;
      lastTs = 0;
      requestAnimationFrame(frame);
    }
  };
  window.fadeOut = function() {
    wrap.classList.remove('on');
    setTimeout(function() {
      if (!wrap.classList.contains('on')) {
        running = false;
        particles.length = 0;
      }
    }, 600);
  };
})();
</script>
</body>
</html>`
