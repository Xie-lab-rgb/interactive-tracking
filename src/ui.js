export function buildUI(panel, state, audioAnalyzer, sceneManager) {
  panel.innerHTML = `
    <div class="panel-title">Flora</div>

    <div class="flower-info">
      <div class="flower-count-row">
        <span class="flower-icon">🌸</span>
        <span class="flower-count" id="flower-count">0</span>
      </div>
      <div class="gesture-rows">
        <div class="gesture-row">
          <span class="gesture-dot" style="background:#58b868"></span>
          <span class="gesture-label">L pinch → Plant</span>
          <span class="gesture-val" id="left-status">—</span>
        </div>
        <div class="gesture-row">
          <span class="gesture-dot" style="background:#e87888"></span>
          <span class="gesture-label">R pinch → Scatter</span>
          <span class="gesture-val" id="right-status">—</span>
        </div>
        <div class="gesture-row">
          <span class="gesture-dot" style="background:#58a8d8"></span>
          <span class="gesture-label">Blink → Water</span>
          <span class="gesture-val" id="blink-status">—</span>
        </div>
        <div class="gesture-row">
          <span class="gesture-dot" style="background:#b878c8"></span>
          <span class="gesture-label">Open mouth → Butterfly</span>
          <span class="gesture-val" id="mouth-status">—</span>
        </div>
        <div class="gesture-row">
          <span class="gesture-dot" style="background:#8a7a6a"></span>
          <span class="gesture-label">Fist release → Burst</span>
          <span class="gesture-val" id="burst-status">—</span>
        </div>
      </div>
      <button class="clear-btn" id="clear-flowers">Clear All</button>
    </div>

    <div class="size-controls">
      <div class="size-row">
        <label class="size-label">花朵大小</label>
        <input type="range" id="flower-size" min="0.5" max="2" step="0.1" value="${state.flowerSize}">
        <span class="size-val" id="flower-size-val">${state.flowerSize}</span>
      </div>
      <div class="size-row">
        <label class="size-label">花瓣大小</label>
        <input type="range" id="petal-size" min="0.5" max="2" step="0.1" value="${state.petalSize}">
        <span class="size-val" id="petal-size-val">${state.petalSize}</span>
      </div>
    </div>

    <div class="divider"></div>

    ${section('audio', 'Audio Input', state.audio.enabled, [
      sub('waveform', 'Waveform', '#58b868', state.audio.waveform),
      sub('frequency', 'Frequency', '#7898d8', state.audio.frequency),
      sub('volume', 'Volume Meter', '#e8b050', state.audio.volume),
    ])}

    <div class="audio-viz-wrap" id="audio-viz-wrap">
      <canvas id="audio-canvas" width="268" height="80"></canvas>
    </div>

    <div class="stats">
      <div class="stat-row"><span class="stat-label">FPS</span><span class="stat-value" id="stat-fps">—</span></div>
      <div class="stat-row"><span class="stat-label">Faces</span><span class="stat-value" id="stat-faces">—</span></div>
      <div class="stat-row"><span class="stat-label">Hands</span><span class="stat-value" id="stat-hands">—</span></div>
      <div class="stat-row"><span class="stat-label">Poses</span><span class="stat-value" id="stat-poses">—</span></div>
    </div>
  `;

  bindAudioToggle(state, panel, audioAnalyzer);

  for (const group of ['audio']) {
    const sec = panel.querySelector(`#section-${group}`);
    if (!sec) continue;
    for (const el of sec.querySelectorAll('[data-key]')) {
      const key = el.dataset.key;
      el.addEventListener('change', () => {
        state[group][key] = el.checked;
      });
    }
  }

  for (const hdr of panel.querySelectorAll('.section-header')) {
    hdr.addEventListener('click', (e) => {
      if (e.target.closest('.toggle')) return;
      const subs = hdr.nextElementSibling;
      if (subs?.classList.contains('sub-options')) subs.classList.toggle('open');
    });
  }

  panel.querySelector('#clear-flowers')?.addEventListener('click', () => {
    sceneManager.clearFlowers();
    const el = document.getElementById('flower-count');
    if (el) el.textContent = '0';
  });

  const flowerSizeInput = document.getElementById('flower-size');
  const flowerSizeVal = document.getElementById('flower-size-val');
  if (flowerSizeInput && flowerSizeVal) {
    flowerSizeInput.addEventListener('input', () => {
      state.flowerSize = parseFloat(flowerSizeInput.value);
      flowerSizeVal.textContent = state.flowerSize.toFixed(1);
    });
  }

  const petalSizeInput = document.getElementById('petal-size');
  const petalSizeVal = document.getElementById('petal-size-val');
  if (petalSizeInput && petalSizeVal) {
    petalSizeInput.addEventListener('input', () => {
      state.petalSize = parseFloat(petalSizeInput.value);
      petalSizeVal.textContent = state.petalSize.toFixed(1);
    });
  }

  const debugToggle = document.getElementById('debug-toggle');
  const debugPanel = document.getElementById('debug-panel');
  if (debugToggle && debugPanel) {
    debugToggle.addEventListener('click', () => {
      debugPanel.classList.toggle('closed');
    });
  }
}

export function updateDebugUI(data) {
  const panel = document.getElementById('debug-panel');
  if (!panel || panel.classList.contains('closed')) return;

  const gesturesEl = document.getElementById('debug-gestures');
  const fpsEl = document.getElementById('debug-fps');
  if (!gesturesEl || !fpsEl) return;

  const GESTURES = [
    { id: 'l-pinch', label: 'L pinch', active: data.leftPinching },
    { id: 'r-pinch', label: 'R pinch', active: data.rightPinching },
    { id: 'blink', label: 'Blink', active: data.blinking },
    { id: 'mouth', label: 'Mouth open', active: data.mouthOpen },
    { id: 'fist', label: 'Fist release', active: data.fistActive },
  ];

  gesturesEl.innerHTML = GESTURES.map((g) =>
    `<span class="debug-gesture ${g.active ? 'active' : ''}" data-gesture="${g.id}">${g.label}${g.active ? ' ✓' : ''}</span>`
  ).join('');

  const fps = data.fps ?? 0;
  fpsEl.textContent = fps;
  fpsEl.classList.remove('low', 'medium', 'good');
  if (fps < 10) fpsEl.classList.add('low');
  else if (fps < 25) fpsEl.classList.add('medium');
  else fpsEl.classList.add('good');
}

function section(id, label, checked, children) {
  return `
    <div class="section" id="section-${id}">
      <div class="section-header" id="header-${id}">
        <span class="label">
          <span class="indicator${checked ? ' active' : ''}" id="ind-${id}"></span>
          ${label}
        </span>
        ${toggle(id, checked)}
      </div>
      <div class="sub-options${checked ? ' open' : ''}">
        ${children.join('')}
      </div>
    </div>`;
}

function sub(key, label, color, checked) {
  return `
    <label class="sub-option">
      <span class="label"><span class="color-dot" style="background:${color}"></span>${label}</span>
      <label class="toggle small" onclick="event.stopPropagation()">
        <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </label>`;
}

function toggle(id, checked) {
  return `<label class="toggle" onclick="event.stopPropagation()">
    <input type="checkbox" id="toggle-${id}" ${checked ? 'checked' : ''}>
    <span class="slider"></span>
  </label>`;
}

function bindSectionToggle(id, state, panel) {
  const input = panel.querySelector(`#toggle-${id}`);
  if (!input) return;
  input.addEventListener('change', () => {
    state[id].enabled = input.checked;
    const ind = panel.querySelector(`#ind-${id}`);
    ind?.classList.toggle('active', input.checked);
    const subs = input.closest('.section-header')?.nextElementSibling;
    if (subs?.classList.contains('sub-options')) {
      subs.classList.toggle('open', input.checked);
    }
  });
}

function bindAudioToggle(state, panel, audioAnalyzer) {
  const input = panel.querySelector('#toggle-audio');
  if (!input) return;
  input.addEventListener('change', async () => {
    const ind = panel.querySelector('#ind-audio');
    const wrap = panel.querySelector('#audio-viz-wrap');
    if (input.checked) {
      try {
        await audioAnalyzer.start();
        state.audio.enabled = true;
        ind?.classList.add('active');
        wrap?.classList.add('visible');
        const subs = input.closest('.section-header')?.nextElementSibling;
        subs?.classList.add('open');
      } catch (err) {
        input.checked = false;
        state.audio.enabled = false;
        console.warn('Microphone access denied:', err);
      }
    } else {
      audioAnalyzer.stop();
      state.audio.enabled = false;
      ind?.classList.remove('active');
      wrap?.classList.remove('visible');
      const subs = input.closest('.section-header')?.nextElementSibling;
      subs?.classList.remove('open');
    }
  });
}

export function updateStats(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('stat-fps', data.fps);
  set('stat-faces', data.faces);
  set('stat-hands', data.hands);
  set('stat-poses', data.poses);
}
