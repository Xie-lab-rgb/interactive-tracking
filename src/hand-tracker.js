import { HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.results = null;
    this.lastTime = -1;
  }

  async init(vision) {
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  }

  detect(video, timestamp) {
    if (!this.landmarker) return null;
    const ts = Math.round(timestamp);
    if (ts <= this.lastTime) return this.results;
    this.lastTime = ts;
    try {
      this.results = this.landmarker.detectForVideo(video, ts);
    } catch {
      /* timestamp conflict — skip frame */
    }
    return this.results;
  }
}
