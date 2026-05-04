import { FilesetResolver } from '@mediapipe/tasks-vision';
import { FaceTracker } from './face-tracker';
import { HandTracker } from './hand-tracker';
import { PoseTracker } from './pose-tracker';
import { AudioAnalyzer } from './audio';
import { OverlayRenderer } from './renderer';
import { SceneManager } from './scene';
import { buildUI, updateStats, updateDebugUI } from './ui';
import './style.css';

const state = {
  audio: {
    enabled: false,
    waveform: true,
    frequency: true,
    volume: true,
  },
  flowerSize: 1,
  petalSize: 1,
};

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const threeCanvas = document.getElementById('three-canvas');
const panel = document.getElementById('panel');
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');

let faceTracker, handTracker, poseTracker, audioAnalyzer;
let renderer, sceneManager;
let fpsFrames = 0;
let fpsTime = 0;
let currentFps = 0;

let leftPinching = false;
let rightPinching = false;
let lastPlantTime = 0;
let lastScatterTime = 0;
let lastTearTime = 0;
let lastButterflyTime = 0;
let isBlinking = false;
let isMouthOpen = false;
let fistState = {};
let lastExplosionTime = 0;
let explosionHand = null;
const PLANT_COOLDOWN = 350;
const EXPLOSION_COOLDOWN = 600;
const SCATTER_INTERVAL = 80;
const TEAR_INTERVAL = 130;
const BUTTERFLY_INTERVAL = 200;

async function init() {
  try {
    loadingText.textContent = 'Requesting camera access…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    });
    video.srcObject = stream;
    await new Promise((r) => {
      video.onloadedmetadata = r;
    });
    await video.play();

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    loadingText.textContent = 'Loading vision models…';
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
    );

    faceTracker = new FaceTracker();
    handTracker = new HandTracker();
    poseTracker = new PoseTracker();
    audioAnalyzer = new AudioAnalyzer();

    loadingText.textContent = 'Initializing trackers…';
    await Promise.all([
      faceTracker.init(vision),
      handTracker.init(vision),
      poseTracker.init(vision),
    ]);

    renderer = new OverlayRenderer(overlay);
    sceneManager = new SceneManager(threeCanvas);
    sceneManager.setSize(video.videoWidth, video.videoHeight);

    buildUI(panel, state, audioAnalyzer, sceneManager);

    loadingEl.classList.add('hidden');
    requestAnimationFrame(loop);
  } catch (err) {
    loadingText.textContent = `Error: ${err.message}`;
    document.querySelector('.spinner')?.remove();
    console.error(err);
  }
}

function checkGestures(handResults, now) {
  const result = { plant: null, scatter: null };
  if (!handResults?.landmarks?.length) {
    leftPinching = false;
    rightPinching = false;
    return result;
  }

  let foundLeft = false;
  let foundRight = false;

  for (let i = 0; i < handResults.landmarks.length; i++) {
    const hand = handResults.landmarks[i];
    const label = handResults.handedness?.[i]?.[0]?.categoryName;
    const thumb = hand[4];
    const index = hand[8];
    const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
    const pos = { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 };

    if (label === 'Left') {
      foundLeft = true;
      if (dist < 0.045) {
        if (!leftPinching && now - lastPlantTime > PLANT_COOLDOWN) {
          leftPinching = true;
          lastPlantTime = now;
          result.plant = pos;
        }
      } else {
        leftPinching = false;
      }
    } else if (label === 'Right') {
      foundRight = true;
      if (dist < 0.045) {
        rightPinching = true;
        if (now - lastScatterTime > SCATTER_INTERVAL) {
          lastScatterTime = now;
          result.scatter = pos;
        }
      } else {
        rightPinching = false;
      }
    }
  }

  if (!foundLeft) leftPinching = false;
  if (!foundRight) rightPinching = false;
  return result;
}

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();

  fpsFrames++;
  if (now - fpsTime >= 1000) {
    currentFps = fpsFrames;
    fpsFrames = 0;
    fpsTime = now;
  }

  const faceResults = faceTracker.detect(video, now);
  const handResults = handTracker.detect(video, now);
  const poseResults = poseTracker.detect(video, now);
  const audioData = state.audio.enabled ? audioAnalyzer.getData() : null;

  const gestures = checkGestures(handResults, now);

  if (gestures.plant) {
    const count = sceneManager.addFlower(gestures.plant.x, state.flowerSize);
    const el = document.getElementById('flower-count');
    if (el) el.textContent = count;
  }

  if (gestures.scatter) {
    sceneManager.scatterPetals(gestures.scatter.x, gestures.scatter.y, state.petalSize);
  }

  checkBlink(faceResults, now);
  checkMouthOpen(faceResults, now);
  checkFistBurst(handResults, now);

  const influencers = [];
  const fingerTips = [];
  if (handResults?.landmarks) {
    for (const hand of handResults.landmarks) {
      influencers.push(hand[0], hand[5], hand[9], hand[13], hand[17]);
      fingerTips.push(hand[4], hand[8], hand[12], hand[16], hand[20]);
    }
  }
  if (poseResults?.landmarks) {
    for (const pose of poseResults.landmarks) {
      for (const idx of [15, 16, 17, 18, 19, 20]) {
        if (pose[idx]) influencers.push(pose[idx]);
      }
    }
  }
  sceneManager.setInfluencers(influencers);
  sceneManager.setFingerTips(fingerTips);

  renderer.clear();
  renderer.drawTearHint(faceResults, isBlinking);
  renderer.drawMouthHint(faceResults, isMouthOpen);
  renderer.drawPinchHint(handResults, leftPinching, rightPinching);

  if (audioData) {
    const ac = document.getElementById('audio-canvas');
    audioAnalyzer.drawTo(ac, audioData, state.audio);
  }

  sceneManager.update();
  sceneManager.render();

  const leftText = document.getElementById('left-status');
  const rightText = document.getElementById('right-status');
  if (leftText) {
    const hasLeft = handResults?.handedness?.some((h) => h[0]?.categoryName === 'Left');
    if (leftPinching) {
      leftText.textContent = 'Planting!';
      leftText.style.color = '#58b868';
    } else if (hasLeft) {
      leftText.textContent = 'Ready';
      leftText.style.color = '#888';
    } else {
      leftText.textContent = '—';
      leftText.style.color = '#444';
    }
  }
  if (rightText) {
    const hasRight = handResults?.handedness?.some((h) => h[0]?.categoryName === 'Right');
    if (rightPinching) {
      rightText.textContent = 'Scattering!';
      rightText.style.color = '#e87888';
    } else if (hasRight) {
      rightText.textContent = 'Ready';
      rightText.style.color = '#888';
    } else {
      rightText.textContent = '—';
      rightText.style.color = '#444';
    }
  }

  const blinkText = document.getElementById('blink-status');
  if (blinkText) {
    if (isBlinking) {
      blinkText.textContent = 'Watering!';
      blinkText.style.color = '#8a9aa8';
    } else if (faceResults?.faceLandmarks?.length) {
      blinkText.textContent = 'Ready';
      blinkText.style.color = '#888';
    } else {
      blinkText.textContent = '—';
      blinkText.style.color = '#444';
    }
  }

  const mouthText = document.getElementById('mouth-status');
  if (mouthText) {
    if (isMouthOpen) {
      mouthText.textContent = 'Butterfly!';
      mouthText.style.color = '#b878c8';
    } else if (faceResults?.faceLandmarks?.length) {
      mouthText.textContent = 'Ready';
      mouthText.style.color = '#888';
    } else {
      mouthText.textContent = '—';
      mouthText.style.color = '#444';
    }
  }

  const burstText = document.getElementById('burst-status');
  if (burstText) {
    if (explosionHand) {
      burstText.textContent = 'Boom!';
      burstText.style.color = '#e8a050';
      explosionHand = null;
    } else if (handResults?.landmarks?.length) {
      const anyFist = Object.values(fistState).some((s) => s);
      burstText.textContent = anyFist ? 'Charging…' : 'Ready';
      burstText.style.color = anyFist ? '#e8a050' : '#888';
    } else {
      burstText.textContent = '—';
      burstText.style.color = '#444';
    }
  }

  updateStats({
    fps: currentFps,
    faces: faceResults?.faceLandmarks?.length ?? 0,
    hands: handResults?.landmarks?.length ?? 0,
    poses: poseResults?.landmarks?.length ?? 0,
  });

  updateDebugUI({
    fps: currentFps,
    leftPinching,
    rightPinching,
    blinking: isBlinking,
    mouthOpen: isMouthOpen,
    fistActive: Object.values(fistState).some(Boolean),
  });
}

function checkFistBurst(handResults, now) {
  if (!handResults?.landmarks?.length) {
    fistState = {};
    return;
  }

  const seen = {};
  for (let i = 0; i < handResults.landmarks.length; i++) {
    const hand = handResults.landmarks[i];
    const label = handResults.handedness?.[i]?.[0]?.categoryName || i;
    seen[label] = true;

    const palm = hand[9];
    const tips = [hand[4], hand[8], hand[12], hand[16], hand[20]];
    let avg = 0;
    for (const t of tips) avg += Math.hypot(t.x - palm.x, t.y - palm.y);
    avg /= 5;

    const wasFist = fistState[label];
    const isFist = avg < 0.07;

    if (wasFist && !isFist && now - lastExplosionTime > EXPLOSION_COOLDOWN) {
      lastExplosionTime = now;
      explosionHand = label;
      const cx = tips.reduce((s, t) => s + t.x, 0) / 5;
      const cy = tips.reduce((s, t) => s + t.y, 0) / 5;
      sceneManager.petalExplosion(cx, cy, state.petalSize);
    }

    fistState[label] = isFist;
  }

  for (const key of Object.keys(fistState)) {
    if (!seen[key]) delete fistState[key];
  }
}

function checkMouthOpen(faceResults, now) {
  isMouthOpen = false;
  if (!faceResults?.faceBlendshapes?.length || !faceResults?.faceLandmarks?.length) return;

  const bs = faceResults.faceBlendshapes[0].categories;
  const jawOpen = bs.find((b) => b.categoryName === 'jawOpen')?.score || 0;

  if (jawOpen < 0.5) return;
  isMouthOpen = true;
  if (now - lastButterflyTime < BUTTERFLY_INTERVAL) return;
  lastButterflyTime = now;

  const lm = faceResults.faceLandmarks[0];
  const mouth = lm[13];
  sceneManager.spawnButterfly(mouth.x, mouth.y);
}

function checkBlink(faceResults, now) {
  isBlinking = false;
  if (!faceResults?.faceBlendshapes?.length || !faceResults?.faceLandmarks?.length) return;

  const bs = faceResults.faceBlendshapes[0].categories;
  const blinkL = bs.find((b) => b.categoryName === 'eyeBlinkLeft')?.score || 0;
  const blinkR = bs.find((b) => b.categoryName === 'eyeBlinkRight')?.score || 0;
  const blinking = blinkL > 0.45 || blinkR > 0.45;

  if (!blinking) return;
  isBlinking = true;
  if (now - lastTearTime < TEAR_INTERVAL) return;
  lastTearTime = now;

  const lm = faceResults.faceLandmarks[0];
  if (blinkL > 0.45) sceneManager.spawnTear(lm[145].x, lm[145].y);
  if (blinkR > 0.45) sceneManager.spawnTear(lm[374].x, lm[374].y);
}

init();
