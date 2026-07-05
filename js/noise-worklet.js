// Generates white/pink/brown noise continuously — no loop point, so no seam.
// Pink: Paul Kellet's refined filter. Brown: leaky integrator over white.
class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.type = options.processorOptions.type;
    this.stopped = false;
    // Pink filter state
    this.b0 = 0; this.b1 = 0; this.b2 = 0; this.b3 = 0; this.b4 = 0; this.b5 = 0; this.b6 = 0;
    // Brown random-walk state
    this.brown = 0;
    this.port.onmessage = (e) => { if (e.data === 'stop') this.stopped = true; };
  }

  process(inputs, outputs) {
    if (this.stopped) return false;
    const out = outputs[0];
    const ch = out[0];
    if (!ch) return true;

    for (let i = 0; i < ch.length; i++) {
      const white = Math.random() * 2 - 1;
      let v;
      if (this.type === 'white') {
        v = white * 0.22;
      } else if (this.type === 'pink') {
        this.b0 = 0.99886 * this.b0 + white * 0.0555179;
        this.b1 = 0.99332 * this.b1 + white * 0.0750759;
        this.b2 = 0.96900 * this.b2 + white * 0.1538520;
        this.b3 = 0.86650 * this.b3 + white * 0.3104856;
        this.b4 = 0.55000 * this.b4 + white * 0.5329522;
        this.b5 = -0.7616 * this.b5 - white * 0.0168980;
        v = (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362) * 0.075;
        this.b6 = white * 0.115926;
      } else { // brown
        this.brown = (this.brown + 0.02 * white) / 1.02;
        v = this.brown * 2.4;
      }
      ch[i] = v;
    }
    // Same signal on any additional channels
    for (let c = 1; c < out.length; c++) out[c].set(ch);
    return true;
  }
}

registerProcessor('noise-processor', NoiseProcessor);
