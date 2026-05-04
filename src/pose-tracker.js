import { PoseLandmarker } from '@mediapipe/tasks-vision';

export class PoseTracker {
  constructor() {
    this.landmarker = null;
    this.results = null;
    this.lastTime = -1;
  }

  async init(vision) {
    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 2,
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
