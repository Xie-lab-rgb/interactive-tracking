import { GROUND_NORM } from './scene';

const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21],
  [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31],
  [28, 30], [30, 32], [28, 32],
].map(([start, end]) => ({ start, end }));

export class OverlayRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGround() {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const surfaceY = h * GROUND_NORM;
    const soilH = h - surfaceY;

    const grad = ctx.createLinearGradient(0, surfaceY, 0, h);
    grad.addColorStop(0, '#4a2c17');
    grad.addColorStop(0.35, '#3b2010');
    grad.addColorStop(1, '#1f110a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, surfaceY, w, soilH);

    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, surfaceY - 1, w, 3);

    ctx.fillStyle = '#22c55e';
    for (let x = 0; x < w; x += 5) {
      const tuftH = 3 + Math.abs(Math.sin(x * 0.37)) * 9;
      ctx.fillRect(x, surfaceY - tuftH, 1.5, tuftH);
    }
    ctx.fillStyle = '#166534';
    for (let x = 3; x < w; x += 8) {
      const tuftH = 2 + Math.abs(Math.cos(x * 0.53)) * 6;
      ctx.fillRect(x, surfaceY - tuftH, 1.5, tuftH);
    }
  }

  drawConnectors(landmarks, connections, color, lineWidth = 1) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const c of connections) {
      const from = landmarks[c.start];
      const to = landmarks[c.end];
      if (!from || !to) continue;
      ctx.moveTo(from.x * w, from.y * h);
      ctx.lineTo(to.x * w, to.y * h);
    }
    ctx.stroke();
  }

  drawPoints(landmarks, color, radius = 2) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.fillStyle = color;
    for (const lm of landmarks) {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPose(results, opts) {
    if (!results?.landmarks?.length) return;
    for (const lm of results.landmarks) {
      if (opts.skeleton) {
        this.drawConnectors(lm, POSE_CONNECTIONS, 'rgba(34,211,238,0.7)', 2.5);
      }
      if (opts.landmarks) {
        this.drawPoints(lm, '#22d3ee', 4);
      }
    }
  }

  drawTearHint(faceResults, blinking) {
    if (!blinking || !faceResults?.faceLandmarks?.length) return;
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const lm = faceResults.faceLandmarks[0];

    for (const idx of [145, 374]) {
      const pt = lm[idx];
      if (!pt) continue;
      const x = pt.x * w;
      const y = pt.y * h;

      ctx.save();
      ctx.translate(x, y + 6);
      ctx.scale(1.3, 1.3);
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.bezierCurveTo(2, -2, 4, 2, 0, 6);
      ctx.bezierCurveTo(-4, 2, -2, -2, 0, -5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(88,168,216,0.55)';
      ctx.fill();
      ctx.restore();
    }
  }

  drawMouthHint(faceResults, mouthOpen) {
    if (!mouthOpen || !faceResults?.faceLandmarks?.length) return;
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const lm = faceResults.faceLandmarks[0];
    const pt = lm[13];
    if (!pt) return;
    const x = pt.x * w;
    const y = pt.y * h;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 10);
    grad.addColorStop(0, 'rgba(184,120,200,0.4)');
    grad.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  drawPinchHint(handResults, leftPinching, rightPinching) {
    if (!handResults?.landmarks?.length) return;
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < handResults.landmarks.length; i++) {
      const hand = handResults.landmarks[i];
      const label = handResults.handedness?.[i]?.[0]?.categoryName;
      const isLeft = label === 'Left';
      const pinching = isLeft ? leftPinching : rightPinching;
      const color = isLeft ? [88, 184, 104] : [232, 120, 136];

      const thumb = hand[4];
      const index = hand[8];
      const cx = ((thumb.x + index.x) / 2) * w;
      const cy = ((thumb.y + index.y) / 2) * h;

      if (pinching) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, 0.25)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, 0.7)`;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(${color}, 0.35)`;
        ctx.beginPath();
        ctx.arc(thumb.x * w, thumb.y * h, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(index.x * w, index.y * h, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = `rgba(${color}, 0.18)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(thumb.x * w, thumb.y * h);
        ctx.lineTo(index.x * w, index.y * h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}
