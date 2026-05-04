import { FaceLandmarker } from '@mediapipe/tasks-vision';

export class FaceTracker {
  constructor() {
    this.landmarker = null;
    this.results = null;
    this.lastTime = -1;
  }

  async init(vision) {
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
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
