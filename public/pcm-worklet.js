// Convierte audio Float32 a PCM16 y lo remuestrea a 16kHz si hace falta.
// En modo microfono (celular) el AudioContext suele correr a 44.1/48kHz,
// asi que no podemos asumir 16k: remuestreamos aca.
class PCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    const inRate = sampleRate; // global del worklet
    const ratio = inRate / this.targetRate;

    if (ratio <= 1.0001) {
      const pcm = this._toPCM(channel);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
      return true;
    }

    // Downsample por promediado de ventana.
    const outLen = Math.floor(channel.length / ratio);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = start; j < end && j < channel.length; j++) {
        sum += channel[j];
        count++;
      }
      let s = count ? sum / count : 0;
      s = Math.max(-1, Math.min(1, s));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(out.buffer, [out.buffer]);
    return true;
  }

  _toPCM(channel) {
    const pcm = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      let s = Math.max(-1, Math.min(1, channel[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm;
  }
}

registerProcessor("pcm-worklet", PCMWorklet);
