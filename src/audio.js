export class AudioAnalyzer {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.freqData = null;
    this.waveData = null;
    this.running = false;
  }

  async start() {
    if (this.running) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.audioCtx = new AudioContext();
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.source.connect(this.analyser);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveData = new Uint8Array(this.analyser.fftSize);
    this.running = true;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.running = false;
  }

  getData() {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.waveData);
    const rms = Math.sqrt(
      this.waveData.reduce((sum, v) => sum + (v - 128) ** 2, 0) /
        this.waveData.length,
    );
    return {
      frequency: this.freqData,
      waveform: this.waveData,
      volume: Math.min(rms / 80, 1),
    };
  }

  drawTo(canvas, data, options) {
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (options.frequency) {
      const barCount = 64;
      const barW = w / barCount;
      const step = Math.floor(data.frequency.length / barCount);
      for (let i = 0; i < barCount; i++) {
        const val = data.frequency[i * step] / 255;
        const barH = val * h * 0.9;
        ctx.fillStyle = `hsla(${250 - val * 120}, 80%, 65%, 0.6)`;
        ctx.fillRect(i * barW, h - barH, barW - 1, barH);
      }
    }

    if (options.waveform) {
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sliceW = w / data.waveform.length;
      for (let i = 0; i < data.waveform.length; i++) {
        const y = (data.waveform[i] / 255) * h;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
    }

    if (options.volume) {
      const barH = 4;
      const barY = h - barH - 2;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, barY, w, barH);
      const vol = data.volume;
      const color =
        vol > 0.8 ? '#f87171' : vol > 0.5 ? '#fbbf24' : '#4ade80';
      ctx.fillStyle = color;
      ctx.fillRect(0, barY, w * vol, barH);
    }
  }
}
