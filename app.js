/* ===== VANTA scroll engine ===== */
(() => {
  const canvas = document.getElementById("film");
  const ctx = canvas.getContext("2d");
  const journey = document.getElementById("journey");
  const hud = document.getElementById("hud");
  const hudSpeed = document.getElementById("hudSpeed");
  const hudFill = document.getElementById("hudFill");
  const hudMode = document.getElementById("hudMode");
  const hudPct = document.getElementById("hudPct");
  const loader = document.getElementById("loader");
  const loaderFill = document.getElementById("loaderFill");
  const loaderLabel = document.getElementById("loaderLabel");
  const overlays = [...document.querySelectorAll(".overlay")];

  const TOP_SPEED = 250;
  const MODES = [
    [0.0, "STANDBY"],
    [0.12, "LAUNCH"],
    [0.28, "FLAT OUT"],
    [0.52, "CANYON"],
    [0.76, "NIGHT MODE"],
  ];

  // ---- frame manifest ----
  let FRAMES = 0;
  const images = [];
  let loadedCount = 0;
  let manifest = null;

  const pad = (n) => String(n).padStart(4, "0");
  const src = (i) => `assets/frames/f_${pad(i + 1)}.jpg`;

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  addEventListener("resize", () => { sizeCanvas(); dirty = true; });
  sizeCanvas();

  // draw image "cover"-style
  function draw(img) {
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const w = iw * s, h = ih * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  // nearest loaded frame at or around index i
  function nearestLoaded(i) {
    if (images[i] && images[i].done) return images[i];
    for (let d = 1; d < FRAMES; d++) {
      const a = images[i - d], b = images[i + d];
      if (a && a.done) return a;
      if (b && b.done) return b;
    }
    return null;
  }

  // ---- scroll state ----
  let progress = 0;      // 0..1 through journey
  let shownFrame = -1;
  let dirty = true;

  function computeProgress() {
    if (window.__vantaForceP != null) return window.__vantaForceP; // debug/screenshot hook
    const rect = journey.getBoundingClientRect();
    const total = journey.offsetHeight - innerHeight;
    const y = Math.min(Math.max(-rect.top, 0), total);
    return total > 0 ? y / total : 0;
  }

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const easeOut = (t) => 1 - Math.pow(1 - t, 2.2);

  // speed curve: 0 while dust settles, climbs through the run, peaks at night exit
  function speedAt(p) {
    const t = clamp01((p - 0.1) / 0.85);
    return Math.round(easeOut(t) * TOP_SPEED);
  }

  function updateHUD(p) {
    const s = speedAt(p);
    hudSpeed.textContent = s;
    hudFill.style.width = (s / TOP_SPEED) * 100 + "%";
    hudPct.textContent = Math.round(p * 100) + "%";
    let mode = MODES[0][1];
    for (const [at, name] of MODES) if (p >= at) mode = name;
    hudMode.textContent = mode;
    // expose for verification
    window.__vanta = { progress: p, speed: s, frame: shownFrame, frames: FRAMES, loaded: loadedCount };
  }

  function updateOverlays(p) {
    for (const el of overlays) {
      const a = parseFloat(el.dataset.in), b = parseFloat(el.dataset.out);
      const span = b - a;
      const fadeIn = clamp01((p - a) / (span * 0.25));
      const fadeOut = clamp01((b - p) / (span * 0.25));
      const o = Math.min(fadeIn, fadeOut);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translateY(${(1 - o) * 26}px)`;
      el.style.pointerEvents = o > 0.5 ? "auto" : "none";
      if (el.id === "statsOverlay" && o > 0.1 && !el.dataset.counted) {
        el.dataset.counted = "1";
        runCounters(el);
      }
    }
  }

  // stat count-up
  function runCounters(root) {
    root.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.dec, 10);
      const t0 = performance.now(), dur = 1400;
      (function tick(now) {
        const t = clamp01((now - t0) / dur);
        const v = target * easeOut(t);
        el.textContent = v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        if (t < 1) requestAnimationFrame(tick);
      })(performance.now());
    });
  }

  // ---- main update ----
  function update() {
    const p = computeProgress();
    if (p !== progress || dirty) {
      progress = p;
      const idx = Math.min(FRAMES - 1, Math.floor(p * FRAMES));
      const img = nearestLoaded(idx);
      if (img) { draw(img); shownFrame = idx; }
      updateHUD(p);
      updateOverlays(p);
      hud.classList.toggle("on", p > 0.02 && p < 1);
      dirty = false;
    }
  }

  // rAF smooths high-frequency scrolling; the scroll listener guarantees
  // updates even when rAF is throttled (hidden/headless tabs)
  function loop() {
    update();
    requestAnimationFrame(loop);
  }
  addEventListener("scroll", update, { passive: true });
  window.__vantaRefresh = () => { dirty = true; update(); };

  // ---- loading ----
  const LOADER_LINES = ["CALIBRATING LIGHT-BAR", "CHARGING 1,200 HP", "MAPPING THE DESERT", "SEALING THE CANOPY"];
  let lineIdx = 0;
  const lineTimer = setInterval(() => {
    lineIdx = (lineIdx + 1) % LOADER_LINES.length;
    loaderLabel.textContent = LOADER_LINES[lineIdx];
  }, 1200);

  function loadFrame(i) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => { img.done = true; loadedCount++; res(img); };
      img.onerror = () => res(null);
      img.src = src(i);
      images[i] = img;
    });
  }

  async function boot() {
    try {
      manifest = await (await fetch("assets/frames/manifest.json")).json();
      FRAMES = manifest.count;
    } catch {
      FRAMES = 0;
    }

    if (!FRAMES) {
      loaderLabel.textContent = "NO FILM FOUND — RUN THE FRAME PIPELINE";
      clearInterval(lineTimer);
      return;
    }

    // phase 1: eager-load a coarse spread (every 6th frame) so scrubbing works immediately
    const eager = [];
    for (let i = 0; i < FRAMES; i += 6) eager.push(i);
    if (!eager.includes(FRAMES - 1)) eager.push(FRAMES - 1);

    let eagerDone = 0;
    await Promise.all(
      eager.map((i) =>
        loadFrame(i).then(() => {
          eagerDone++;
          loaderFill.style.width = (eagerDone / eager.length) * 100 + "%";
        })
      )
    );

    clearInterval(lineTimer);
    loader.classList.add("done");
    dirty = true;
    loop();

    // phase 2: fill the gaps in the background, nearest-to-viewport first
    const rest = [];
    for (let i = 0; i < FRAMES; i++) if (!images[i]) rest.push(i);
    const CONC = 8;
    let cursor = 0;
    async function worker() {
      while (cursor < rest.length) {
        const i = rest[cursor++];
        await loadFrame(i);
        const cur = Math.floor(progress * FRAMES);
        if (Math.abs(i - cur) < 8) dirty = true;
      }
    }
    Promise.all(Array.from({ length: CONC }, worker));
  }

  // ---- configurator ----
  const configImg = document.getElementById("configImg");
  const configName = document.getElementById("configName");
  document.querySelectorAll(".swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".swatch").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      configImg.style.opacity = 0;
      const img = new Image();
      img.onload = () => { configImg.src = btn.dataset.img; configImg.style.opacity = 1; };
      img.src = btn.dataset.img;
      configName.textContent = btn.dataset.name;
    });
  });

  boot();
})();
