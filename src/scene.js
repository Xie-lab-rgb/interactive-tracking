import * as THREE from 'three';

/* ── helpers ──────────────────────────────── */
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));

const GROUND_NORM = 0.96;
export { GROUND_NORM };

/* ── SceneManager ────────────────────────── */
export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    this.camera.position.z = 2;
    this.flowers = [];
    this.particles = [];
    this.butterflies = [];
    this.influencers = [];
    this.dustMotes = [];
    this._prevTips = [];
    this._fingerTips = [];
    this.visibleWidth = 1;
    this.visibleHeight = 1;
    this.groundWorldY = 0;
    this.lastTime = performance.now();
  }

  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const vFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    this.visibleHeight = 2 * Math.tan(vFov) * this.camera.position.z;
    this.visibleWidth = this.visibleHeight * this.camera.aspect;
    this.groundWorldY = -(GROUND_NORM - 0.5) * this.visibleHeight;
  }

  toWorld(nx, ny) {
    return new THREE.Vector2(
      (nx - 0.5) * this.visibleWidth,
      -(ny - 0.5) * this.visibleHeight,
    );
  }

  setInfluencers(normPoints) {
    this.influencers = normPoints.map((p) => this.toWorld(p.x, p.y));
  }

  setFingerTips(normTips) {
    this._fingerTips = normTips.map((p) => this.toWorld(p.x, p.y));
  }

  spawnDust(x, y, vx, vy) {
    const GLOW = ['#fff8e0', '#f8f0e8', '#f0f8ff', '#fff0f8', '#f8fff0', '#fffaf0', '#f0f0ff', '#f8e8d8'];
    const size = rand(0.003, 0.008);
    const geo = new THREE.CircleGeometry(size, 5);
    const color = pick(GLOW);
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    }));
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(size * 2.5, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    halo.position.z = -0.001;
    const g = new THREE.Group();
    g.add(core);
    g.add(halo);
    g.position.set(x + rand(-0.02, 0.02), y + rand(-0.02, 0.02), 0.05);
    g.userData = {
      vx: vx * rand(0.05, 0.3) + rand(-0.04, 0.04),
      vy: vy * rand(0.05, 0.3) + rand(0.01, 0.06),
      life: 1,
      decay: rand(0.25, 0.55),
      twinkle: Math.random() * Math.PI * 2,
      core, halo,
    };
    this.scene.add(g);
    this.dustMotes.push(g);
  }

  addFlower(nx, sizeMult = 1) {
    const worldX = (nx - 0.5) * this.visibleWidth;
    const flower = buildFlower();
    const stemH = flower.userData._stemH || 0.1;
    const ts = flower.userData.targetScale * sizeMult;

    const pivot = new THREE.Group();
    pivot.position.set(worldX, this.groundWorldY, 0);
    flower.position.set(0, stemH * ts, 0);
    pivot.add(flower);

    pivot.userData = {
      _inner: flower,
      targetScale: ts,
      _stemH: stemH,
      _stemMesh: flower.userData._stemMesh,
      baseRot: flower.userData.baseRot,
      phase: flower.userData.phase,
      growing: flower.userData.growing,
      progress: flower.userData.progress,
      color: flower.userData.color,
    };

    this.scene.add(pivot);
    this.flowers.push(pivot);
    this.spawnParticles(worldX, this.groundWorldY + stemH * ts * 0.8, flower.userData.color);
    return this.flowers.length;
  }

  clearFlowers() {
    for (const f of this.flowers) { dispose(f); this.scene.remove(f); }
    this.flowers.length = 0;
    for (const p of this.particles) { dispose(p); this.scene.remove(p); }
    this.particles.length = 0;
    for (const b of this.butterflies) { dispose(b); this.scene.remove(b); }
    this.butterflies.length = 0;
    for (const d of this.dustMotes) { dispose(d); this.scene.remove(d); }
    this.dustMotes.length = 0;
  }

  spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 0.4 + Math.random() * 0.4;
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(0.006, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide }),
      );
      m.position.set(x, y, 0.02);
      m.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.15, life: 1, decay: 2.5 };
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  spawnTear(nx, ny) {
    const pos = this.toWorld(nx, ny);
    const size = rand(0.012, 0.02);
    const geo = tearDropGeo(size);
    const mat = new THREE.MeshBasicMaterial({
      color: '#58a8d8', transparent: true, opacity: 0.88, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x + rand(-0.01, 0.01), pos.y, 0.03);
    mesh.userData = {
      type: 'tear',
      vx: rand(-0.06, 0.06),
      vy: rand(-0.15, -0.05),
      gravity: 0.6,
      life: 1,
      decay: 0.18,
    };
    this.scene.add(mesh);
    this.particles.push(mesh);
  }

  waterFlower(flower) {
    const waterScale = flower.userData.waterScale || 1;
    if (waterScale >= 3.0) return;
    flower.userData.waterScale = Math.min(waterScale + 0.18, 3.0);
    this.spawnSplash(flower.position.x, this.groundWorldY + 0.02);
  }

  spawnSplash(x, y) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI;
      const sp = rand(0.15, 0.4);
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(rand(0.005, 0.01), 6),
        new THREE.MeshBasicMaterial({ color: '#78b8e8', transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
      );
      m.position.set(x + rand(-0.02, 0.02), y, 0.025);
      m.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.1, life: 1, decay: 2.5 };
      this.scene.add(m);
      this.particles.push(m);
    }
  }

  spawnButterfly(nx, ny) {
    const pos = this.toWorld(nx, ny);
    const b = buildButterfly();
    const angle = rand(-Math.PI * 0.8, Math.PI * 0.8);
    const speed = rand(0.25, 0.55);
    b.position.set(pos.x, pos.y, 0.04);
    b.userData = {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.4 + rand(0.15, 0.35),
      flapOffset: Math.random() * Math.PI * 2,
      flapSpeed: rand(6, 10),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: rand(0.15, 0.4),
      life: 1,
      decay: rand(0.12, 0.22),
      leftWing: b.children[0],
      rightWing: b.children[1],
    };
    this.scene.add(b);
    this.butterflies.push(b);
  }

  petalExplosion(nx, ny, sizeMult = 1) {
    const pos = this.toWorld(nx, ny);
    const COLORS = [
      '#d87880', '#d87088', '#d88870', '#b8a0d8', '#d8a848',
      '#d06878', '#b090c8', '#e0b050', '#d88088', '#c8a8e0',
      '#c87078', '#d89060', '#b088c0', '#e09888', '#d8b858',
    ];
    const geos = [tearPetal, roundPetal, thinPetal, notchedPetal, pointedPetal, crinkledPetal];
    const count = 35;
    for (let i = 0; i < count; i++) {
      const size = rand(0.04, 0.12) * sizeMult;
      const geo = pick(geos)(size);
      const color = pick(COLORS);
      const       mat = new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide, transparent: true, opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = rand(0.6, 2.0);
      mesh.position.set(pos.x + rand(-0.03, 0.03), pos.y + rand(-0.03, 0.03), 0.02);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      mesh.userData = {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7,
        vr: rand(-5, 5),
        gravity: rand(0.3, 0.7),
        life: 1,
        decay: rand(0.25, 0.45),
      };
      this.scene.add(mesh);
      this.particles.push(mesh);
    }
  }

  scatterPetals(nx, ny, sizeMult = 1) {
    const pos = this.toWorld(nx, ny);
    const COLORS = [
      '#d87880', '#d87088', '#d8a848', '#b8a0d8', '#d88870',
      '#b090c8', '#d06878', '#e0b050', '#d88088', '#c8a8e0',
    ];
    const geos = [tearPetal, roundPetal, thinPetal, notchedPetal, pointedPetal];
    for (let i = 0; i < 8; i++) {
      const size = rand(0.05, 0.10) * sizeMult;
      const geo = pick(geos)(size);
      const color = pick(COLORS);
      const       mat = new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide, transparent: true, opacity: 0.88,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(0.5, 1.4);
      mesh.position.set(pos.x + rand(-0.05, 0.05), pos.y + rand(-0.05, 0.05), 0.02);
      mesh.rotation.z = Math.random() * Math.PI * 2;
      mesh.userData = {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 + rand(0.1, 0.35),
        vr: rand(-3, 3),
        gravity: rand(0.1, 0.25),
        life: 1,
        decay: rand(0.35, 0.6),
      };
      this.scene.add(mesh);
      this.particles.push(mesh);
    }
  }

  update() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    for (const f of this.flowers) {
      const inner = f.userData._inner;
      const base = f.userData.targetScale || 1;
      const stemH = f.userData._stemH || 0.1;
      const stemMesh = f.userData._stemMesh;

      const targetWS = f.userData.waterScale || 1;
      let curWS = f.userData._curWS ?? 1;
      if (Math.abs(curWS - targetWS) > 0.001) {
        curWS += (targetWS - curWS) * Math.min(dt * 3, 0.08);
      }
      f.userData._curWS = curWS;

      let pushForce = 0;
      for (const inf of this.influencers) {
        const dx = f.position.x - inf.x;
        const dy = f.position.y - inf.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = 0.5;
        if (dist < radius && dist > 0.001) {
          const strength = ((1 - dist / radius) ** 2) * 0.6;
          pushForce += (dx > 0 ? 1 : -1) * strength;
        }
      }

      const curPush = f.userData._pushForce || 0;
      const newPush = curPush + (pushForce - curPush) * Math.min(dt * 5, 0.15);
      f.userData._pushForce = newPush;

      const ph = f.userData.phase;
      const px = f.position.x * 4.0;
      const w1 = Math.sin(now * 0.0010 + px + ph * 0.3) * 0.04;
      const w2 = Math.sin(now * 0.0023 - px * 0.7 + ph * 0.2) * 0.025;
      const w3 = Math.sin(now * 0.0037 + px * 1.3 + ph * 0.15) * 0.015;
      const windSway = w1 + w2 + w3 + newPush;

      let gs;
      if (f.userData.growing) {
        f.userData.progress = Math.min(f.userData.progress + dt * 2.5, 1);
        const t = f.userData.progress;
        const c1 = 1.70158, c3 = c1 + 1;
        const ease = Math.max(0, 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2);
        gs = ease * base;
        if (t >= 1) f.userData.growing = false;
      } else {
        gs = base;
      }

      f.rotation.z = windSway * 0.5;
      inner.rotation.z = f.userData.baseRot + windSway * 0.3;

      inner.scale.setScalar(gs);

      if (stemMesh) {
        stemMesh.scale.y = curWS;
        stemMesh.position.y = -(stemMesh.userData._origH * curWS) / 2;
        if (stemMesh.userData._origPos) {
          waveStem(stemMesh, windSway, now, ph);
        }
      }

      inner.position.y = stemH * gs * curWS;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const decay = p.userData.decay || 2.5;
      p.userData.life -= dt * decay;
      if (p.userData.life <= 0) { dispose(p); this.scene.remove(p); this.particles.splice(i, 1); continue; }
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      if (p.userData.gravity) p.userData.vy -= p.userData.gravity * dt;
      if (p.userData.vr) p.rotation.z += p.userData.vr * dt;
      p.material.opacity = p.userData.life;
      if (!p.userData.type) p.scale.setScalar(0.5 + p.userData.life * 0.5);

      if (p.userData.type === 'tear' && p.position.y <= this.groundWorldY + 0.08) {
        let nearest = null;
        let minDx = 0.18;
        for (const f of this.flowers) {
          const dx = Math.abs(f.position.x - p.position.x);
          if (dx < minDx) { minDx = dx; nearest = f; }
        }
        if (nearest) this.waterFlower(nearest);
        dispose(p); this.scene.remove(p); this.particles.splice(i, 1);
      }
    }

    for (let i = this.butterflies.length - 1; i >= 0; i--) {
      const b = this.butterflies[i];
      const d = b.userData;
      d.life -= dt * d.decay;
      if (d.life <= 0) { dispose(b); this.scene.remove(b); this.butterflies.splice(i, 1); continue; }

      b.position.x += d.vx * dt + Math.sin(now * 0.002 + d.wobblePhase) * d.wobbleAmp * dt;
      b.position.y += d.vy * dt;
      d.vy += dt * 0.08;

      const flap = Math.sin(now * 0.001 * d.flapSpeed + d.flapOffset);
      if (d.leftWing) d.leftWing.rotation.y = flap * 0.9;
      if (d.rightWing) d.rightWing.rotation.y = -flap * 0.9;

      b.rotation.z = Math.sin(now * 0.0015 + d.wobblePhase) * 0.15;

      b.traverse((c) => {
        if (c.material) c.material.opacity = Math.max(0, d.life);
      });
    }

    const tips = this._fingerTips;
    const prev = this._prevTips;
    if (tips.length) {
      for (let i = 0; i < tips.length; i++) {
        const t = tips[i];
        const p = prev[i];
        if (p) {
          const dvx = t.x - p.x;
          const dvy = t.y - p.y;
          const spd = Math.sqrt(dvx * dvx + dvy * dvy);
          if (spd > 0.002) {
            const n = Math.min(Math.ceil(spd * 300), 3);
            for (let j = 0; j < n; j++) this.spawnDust(t.x, t.y, dvx, dvy);
          }
        }
      }
      this._prevTips = tips.map((t) => ({ x: t.x, y: t.y }));
    } else {
      this._prevTips = [];
    }

    for (let i = this.dustMotes.length - 1; i >= 0; i--) {
      const m = this.dustMotes[i];
      const u = m.userData;
      u.life -= dt * u.decay;
      if (u.life <= 0) { dispose(m); this.scene.remove(m); this.dustMotes.splice(i, 1); continue; }
      m.position.x += u.vx * dt;
      m.position.y += u.vy * dt;
      u.vy += dt * 0.015;
      const tw = 0.5 + 0.5 * Math.sin(now * 0.008 + u.twinkle);
      u.core.material.opacity = u.life * (0.6 + 0.4 * tw);
      u.halo.material.opacity = u.life * 0.2 * tw;
      m.scale.setScalar(0.7 + 0.3 * tw);
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

/* ── flower factory ──────────────────────── */
const BUILDERS = [buildRose, buildDaisy, buildSunflower, buildTulip, buildSakura, buildCosmos, buildPoppy];

function buildFlower() {
  const g = pick(BUILDERS)();
  const targetScale = g.scale.x || 1;
  g.userData.targetScale = targetScale;
  const baseRot = (Math.random() - 0.5) * 0.35;
  g.rotation.z = baseRot;
  g.userData.baseRot = baseRot;
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.growing = true;
  g.userData.progress = 0;
  g.scale.setScalar(0);
  return g;
}

/* ── 1. Rose ─────────────────────────────── */
function buildRose() {
  const g = new THREE.Group();
  const palette = ['#d4727a', '#dc7a82', '#e0848c', '#c86a72', '#d87880', '#e08c94'];
  const color = pick(palette);
  const size = rand(0.05, 0.085);
  const scale = rand(1.4, 2.2);

  addStem(g, size * rand(1.8, 2.2), 0.003, 0.005, '#4a7a52');
  addLeaf(g, 0.45, 0.032, -0.4, '#5a8a5a');

  const geo1 = tearPetal(size * 0.65);
  const geo2 = tearPetal(size);
  addPetalRing(g, 6, geo1, color, 0.92, 0.48, size * 0.06, 0.001, size * 0.65, true);
  addPetalRing(g, 6, geo2, color, 0.86, 0.38, size * 0.14, 0.0005, size, true, Math.PI / 6);
  addCenter(g, size * 0.18, '#e0b858', 0.012, true);

  g.scale.setScalar(scale);
  g.userData.color = color;
  return g;
}

/* ── 2. Daisy ────────────────────────────── */
function buildDaisy() {
  const g = new THREE.Group();
  const petalColor = pick(['#f0e6d8', '#f5ebe0', '#ebe4d8', '#e8e4e0', '#f0e8e4']);
  const size = rand(0.055, 0.08);
  const scale = rand(1.2, 2.0);

  addStem(g, size * rand(1.8, 2.2), 0.003, 0.004, '#4a7a52');
  addLeaf(g, 0.4, 0.028, -0.5, '#5a8a5a');

  const geo = thinPetal(size);
  addPetalRing(g, 8, geo, petalColor, 0.9, 0.45, size * 0.08, 0.0005, size, true);
  addPetalRing(g, 8, geo, petalColor, 0.82, 0.35, size * 0.14, 0.0008, size, true, Math.PI / 8);
  addCenter(g, size * 0.35, '#e8c850', 0.012, true);

  g.scale.setScalar(scale);
  g.userData.color = petalColor;
  return g;
}

/* ── 3. Sunflower ────────────────────────── */
function buildSunflower() {
  const g = new THREE.Group();
  const petalColor = pick(['#d8a848', '#e0b050', '#e8b858', '#d0a040', '#e0b048']);
  const size = rand(0.045, 0.065);
  const scale = rand(1.8, 2.8);

  addStem(g, size * rand(1.8, 2.2), 0.004, 0.006, '#4a7a52');
  addLeaf(g, 0.4, 0.038, -0.3, '#5a8a5a');
  addLeaf(g, 0.6, 0.034, Math.PI + 0.3, '#4a7a52');

  const geo = pointedPetal(size);
  addPetalRing(g, 10, geo, petalColor, 0.9, 0.42, size * 0.12, 0.0003, size, true);
  addPetalRing(g, 10, geo, petalColor, 0.82, 0.32, size * 0.2, 0.0006, size, true, Math.PI / 10);
  addCenter(g, size * 0.45, '#5a4530', 0.012, true);
  addCenter(g, size * 0.3, '#6a5540', 0.014);

  g.scale.setScalar(scale);
  g.userData.color = petalColor;
  return g;
}

/* ── 4. Tulip ────────────────────────────── */
function buildTulip() {
  const g = new THREE.Group();
  const palette = ['#d87078', '#e07880', '#c86870', '#c87898', '#d88870', '#d87880'];
  const color = pick(palette);
  const size = rand(0.065, 0.095);
  const scale = rand(1.3, 2.0);

  addStem(g, size * rand(1.8, 2.2), 0.003, 0.005, '#4a7a52');
  addLeaf(g, 0.3, 0.042, -0.2, '#5a8a5a');

  const geo = widePetal(size);
  const tMat = gradientPetalMaterial(color, size * 1.1, 0.9, 0.4, false);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const m = new THREE.Mesh(geo, tMat);
    m.rotation.z = angle - Math.PI / 2;
    m.position.set(Math.cos(angle) * size * 0.05, Math.sin(angle) * size * 0.05, 0.003 * i);
    g.add(m);
  }

  g.scale.setScalar(scale);
  g.userData.color = color;
  return g;
}

/* ── 5. Sakura (Cherry Blossom) ──────────── */
function buildSakura() {
  const g = new THREE.Group();
  const palette = ['#e8b8c8', '#e0b0c0', '#e8c0d0', '#e0a8b8', '#e8c8d8', '#e4bcc8'];
  const color = pick(palette);
  const size = rand(0.05, 0.075);
  const scale = rand(1.0, 1.7);

  addStem(g, size * rand(1.8, 2.2), 0.003, 0.004, '#4a7a52');

  const geo = notchedPetal(size);
  addPetalRing(g, 5, geo, color, 0.9, 0.45, size * 0.08, 0.0005, size * 0.94, true);
  addPetalRing(g, 5, geo, color, 0.82, 0.35, size * 0.12, 0.001, size * 0.94, true, Math.PI / 5);
  addCenter(g, size * 0.2, '#e0a8b0', 0.012, true);

  const stamenCount = 5;
  for (let i = 0; i < stamenCount; i++) {
    const a = (i / stamenCount) * Math.PI * 2;
    const len = size * 0.4;
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.001, 0.001, len, 4),
      new THREE.MeshBasicMaterial({ color: '#c89850' }),
    );
    line.rotation.z = a;
    line.position.set(Math.cos(a) * len * 0.4, Math.sin(a) * len * 0.4, 0.015);
    g.add(line);
    const tip = new THREE.Mesh(
      new THREE.CircleGeometry(0.003, 6),
      new THREE.MeshBasicMaterial({ color: '#d88890', side: THREE.DoubleSide }),
    );
    tip.position.set(Math.cos(a) * len * 0.85, Math.sin(a) * len * 0.85, 0.016);
    g.add(tip);
  }

  g.scale.setScalar(scale);
  g.userData.color = color;
  return g;
}

/* ── 6. Cosmos ───────────────────────────── */
function buildCosmos() {
  const g = new THREE.Group();
  const palette = ['#b8a0d8', '#c0a8e0', '#a890c8', '#c8b0e8', '#b098d0', '#c0a0d8'];
  const color = pick(palette);
  const size = rand(0.055, 0.085);
  const scale = rand(1.3, 2.0);

  addStem(g, size * rand(1.8, 2.2), 0.003, 0.004, '#4a7a52');
  addLeaf(g, 0.4, 0.026, -0.4, '#5a8a5a');

  const geo = roundPetal(size);
  addPetalRing(g, 8, geo, color, 0.9, 0.42, size * 0.06, 0.0005, size, true);
  addPetalRing(g, 8, geo, color, 0.82, 0.32, size * 0.12, 0.001, size, true, Math.PI / 8);
  addCenter(g, size * 0.22, '#e8c850', 0.012, true);

  g.scale.setScalar(scale);
  g.userData.color = color;
  return g;
}

/* ── 7. Poppy ────────────────────────────── */
function buildPoppy() {
  const g = new THREE.Group();
  const palette = ['#d05868', '#d86070', '#c85060', '#c85868', '#d86878', '#d05060'];
  const color = pick(palette);
  const size = rand(0.065, 0.095);
  const scale = rand(1.4, 2.2);

  addStem(g, size * rand(1.8, 2.2), 0.003, 0.005, '#4a7a52');

  const geo = crinkledPetal(size);
  const pMat = gradientPetalMaterial(color, size * 1.08, 0.9, 0.38, false);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const m = new THREE.Mesh(geo, pMat);
    m.rotation.z = angle - Math.PI / 2;
    m.position.set(Math.cos(angle) * size * 0.08, Math.sin(angle) * size * 0.08, 0.002 * i);
    g.add(m);
  }

  addCenter(g, size * 0.28, '#4a3830', 0.012);
  addCenter(g, size * 0.18, '#5a4840', 0.015);

  g.scale.setScalar(scale);
  g.userData.color = color;
  return g;
}

/* ── shared components ───────────────────── */
function addStem(group, height, topR, botR, color) {
  const geo = new THREE.CylinderGeometry(topR, botR, height, 6, 10);
  geo.computeBoundingSphere = () => { geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), height); };
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  m.position.y = -height / 2;
  m.userData._origH = height;
  m.userData._origPos = new Float32Array(geo.attributes.position.array);
  m.frustumCulled = false;
  group.add(m);
  group.userData._stemH = height;
  group.userData._stemMesh = m;
}

function addLeaf(group, stemFraction, leafSize, rotZ, color) {
  const stemH = group.userData._stemH || 0.08;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(leafSize * 0.55, leafSize * 0.3, leafSize, 0);
  shape.quadraticCurveTo(leafSize * 0.55, -leafSize * 0.3, 0, 0);
  const m = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );
  m.position.set(0.004, -stemH * stemFraction, 0);
  m.rotation.z = rotZ;
  group.add(m);
}

function gradientPetalMaterial(color, petalLength, opacityRoot, opacityTip, depthWrite = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPetalLength: { value: petalLength },
      uOpacityRoot: { value: opacityRoot },
      uOpacityTip: { value: opacityTip },
    },
    vertexShader: `
      uniform float uPetalLength;
      varying float vGrad;
      void main() {
        vGrad = clamp(position.y / uPetalLength, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacityRoot;
      uniform float uOpacityTip;
      varying float vGrad;
      void main() {
        float t = vGrad * vGrad * (3.0 - 2.0 * vGrad);
        float a = mix(uOpacityRoot, uOpacityTip, t);
        vec3 col = mix(uColor, uColor + vec3(0.06, 0.06, 0.06), vGrad * 0.5);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite,
    side: THREE.DoubleSide,
  });
}

function addPetalRing(group, count, geo, color, opacityRoot, opacityTip, spread, zStep, petalLength, translucent = false, angleOffset = 0) {
  const mat = gradientPetalMaterial(color, petalLength, opacityRoot, opacityTip, !translucent);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + angleOffset;
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = angle - Math.PI / 2;
    m.position.set(Math.cos(angle) * spread, Math.sin(angle) * spread, zStep * i);
    group.add(m);
  }
}

function addCenter(group, radius, color, z, glow = false) {
  if (glow) {
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 2.4, 20),
      new THREE.MeshBasicMaterial({ color: '#fffef8', transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    halo.position.z = z - 0.001;
    group.add(halo);
    const star = starGeometry(radius, 6);
    const m = new THREE.Mesh(star, new THREE.MeshBasicMaterial({ color: '#fffef5', side: THREE.DoubleSide }));
    m.position.z = z;
    group.add(m);
  } else {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 14),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    m.position.z = z;
    group.add(m);
  }
}

function starGeometry(radius, points) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = (i % 2 === 0) ? radius : radius * 0.38;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/* ── petal geometries ────────────────────── */
function tearPetal(s) {
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.bezierCurveTo(s * 0.5, s * 0.25, s * 0.42, s * 0.82, 0, s);
  p.bezierCurveTo(-s * 0.42, s * 0.82, -s * 0.5, s * 0.25, 0, 0);
  return new THREE.ShapeGeometry(p);
}

function thinPetal(s) {
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.bezierCurveTo(s * 0.14, s * 0.3, s * 0.11, s * 0.85, 0, s);
  p.bezierCurveTo(-s * 0.11, s * 0.85, -s * 0.14, s * 0.3, 0, 0);
  return new THREE.ShapeGeometry(p);
}

function pointedPetal(s) {
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.bezierCurveTo(s * 0.3, s * 0.15, s * 0.28, s * 0.6, 0, s);
  p.bezierCurveTo(-s * 0.28, s * 0.6, -s * 0.3, s * 0.15, 0, 0);
  return new THREE.ShapeGeometry(p);
}

function widePetal(s) {
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.bezierCurveTo(s * 0.72, s * 0.12, s * 0.65, s * 0.88, 0, s * 1.1);
  p.bezierCurveTo(-s * 0.65, s * 0.88, -s * 0.72, s * 0.12, 0, 0);
  return new THREE.ShapeGeometry(p);
}

function notchedPetal(s) {
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.bezierCurveTo(s * 0.48, s * 0.18, s * 0.52, s * 0.72, s * 0.15, s * 0.94);
  p.lineTo(0, s * 0.78);
  p.lineTo(-s * 0.15, s * 0.94);
  p.bezierCurveTo(-s * 0.52, s * 0.72, -s * 0.48, s * 0.18, 0, 0);
  return new THREE.ShapeGeometry(p);
}

function roundPetal(s) {
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.bezierCurveTo(s * 0.58, s * 0.12, s * 0.58, s * 0.88, 0, s);
  p.bezierCurveTo(-s * 0.58, s * 0.88, -s * 0.58, s * 0.12, 0, 0);
  return new THREE.ShapeGeometry(p);
}

function crinkledPetal(s) {
  const p = new THREE.Shape();
  p.moveTo(0, 0);
  p.bezierCurveTo(s * 0.65, s * 0.05, s * 0.7, s * 0.55, s * 0.2, s * 0.95);
  p.quadraticCurveTo(0, s * 1.08, -s * 0.2, s * 0.95);
  p.bezierCurveTo(-s * 0.7, s * 0.55, -s * 0.65, s * 0.05, 0, 0);
  return new THREE.ShapeGeometry(p);
}

/* ── butterfly ───────────────────────────── */
const BF_PAIRS = [
  ['#b8a8e8', '#8878c8'],
  ['#a8c8e8', '#6898c8'],
  ['#e8c8b8', '#c89888'],
  ['#e8c8d8', '#c898b8'],
  ['#c8e8b8', '#98c888'],
  ['#e8b8b8', '#c88888'],
  ['#d8b8e8', '#b888c8'],
  ['#b8e8d8', '#88c8b8'],
];

function bfWing(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(s * 0.7, s * 0.35, s * 0.55, s * 0.8);
  sh.quadraticCurveTo(s * 0.15, s * 0.7, 0, s * 0.35);
  return new THREE.ShapeGeometry(sh);
}

function bfLower(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(s * 0.5, -s * 0.1, s * 0.4, -s * 0.35);
  sh.quadraticCurveTo(s * 0.1, -s * 0.3, 0, -s * 0.05);
  return new THREE.ShapeGeometry(sh);
}

function buildButterfly() {
  const group = new THREE.Group();
  const s = rand(0.03, 0.045);
  const [light, dark] = pick(BF_PAIRS);

  const wMat = new THREE.MeshBasicMaterial({ color: light, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const wMat2 = new THREE.MeshBasicMaterial({ color: dark, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });

  const lw = new THREE.Group();
  lw.add(new THREE.Mesh(bfWing(s), wMat));
  lw.add(new THREE.Mesh(bfLower(s), wMat2));
  group.add(lw);

  const rw = new THREE.Group();
  rw.add(new THREE.Mesh(bfWing(s), wMat.clone()));
  rw.add(new THREE.Mesh(bfLower(s), wMat2.clone()));
  rw.scale.x = -1;
  group.add(rw);

  const bodyGeo = new THREE.PlaneGeometry(s * 0.06, s * 0.7);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: '#44403c', side: THREE.DoubleSide }));
  body.position.set(0, s * 0.15, 0.001);
  group.add(body);

  const antMat = new THREE.LineBasicMaterial({ color: '#78716c' });
  for (const side of [-1, 1]) {
    const pts = [new THREE.Vector3(0, s * 0.5, 0), new THREE.Vector3(side * s * 0.3, s * 0.85, 0)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(geo, antMat));
  }

  group.scale.setScalar(rand(1.0, 1.5));
  return group;
}

/* ── tear drop geometry ──────────────────── */
function tearDropGeo(size) {
  const s = new THREE.Shape();
  s.moveTo(0, size * 1.2);
  s.bezierCurveTo(size * 0.15, size * 0.9, size * 0.4, size * 0.3, size * 0.32, -size * 0.1);
  s.quadraticCurveTo(0, -size * 0.5, -size * 0.32, -size * 0.1);
  s.bezierCurveTo(-size * 0.4, size * 0.3, -size * 0.15, size * 0.9, 0, size * 1.2);
  return new THREE.ShapeGeometry(s);
}

/* ── stem wave bending ───────────────────── */
function waveStem(mesh, sway, now, phase) {
  const pos = mesh.geometry.attributes.position;
  const orig = mesh.userData._origPos;
  const h = mesh.userData._origH;
  const arr = pos.array;
  const time = now * 0.003;
  for (let i = 0; i < pos.count; i++) {
    const oy = orig[i * 3 + 1];
    const t = oy / h + 0.5;
    const bend = sway * h * t * t;
    const wave = Math.sin(t * Math.PI * 2.5 - time + phase) * h * 0.08 * t;
    arr[i * 3] = orig[i * 3] + bend + wave;
  }
  pos.needsUpdate = true;
}

/* ── dispose ─────────────────────────────── */
function dispose(obj) {
  obj.traverse?.((c) => {
    c.geometry?.dispose();
    const m = c.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}
