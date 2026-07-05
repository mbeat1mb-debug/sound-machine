// Audio engine. Graph per SPEC (built so v2 multi-sound mixing is additive):
//   source (worklet noise | looped buffer) -> per-sound GainNode -> master GainNode
//     -> MediaStreamAudioDestinationNode -> <audio>.srcObject
// Routing through the real <audio> element is what makes iOS lock-screen
// controls possible (Phase 2). Volume/fades use gain ramps only — iOS ignores
// programmatic element volume.

export const SOUNDS = {
  brown:    { label: 'Brown Noise', kind: 'noise' },
  white:    { label: 'White Noise', kind: 'noise' },
  pink:     { label: 'Pink Noise',  kind: 'noise' },
  // MP3 (not AAC): decodable by both iOS Safari and open Chromium builds used
  // in automated tests. The decode-time crossfade below removes MP3's encoder
  // gap, so looping stays seamless.
  rain:     { label: 'Rain',        kind: 'file', src: 'sounds/rain.mp3' },
  ocean:    { label: 'Ocean Waves', kind: 'file', src: 'sounds/ocean.mp3' },
  fan:      { label: 'Box Fan',     kind: 'file', src: 'sounds/fan.mp3' },
  crickets: { label: 'Crickets',    kind: 'file', src: 'sounds/crickets.mp3' },
};

const SWITCH_FADE = 0.03;    // s, kills clicks when starting/stopping a source
const LOOP_XFADE = 1.5;      // s, runtime loop crossfade for file sounds
const SILENCE_THRESHOLD = 1e-3;

export class Engine {
  constructor(audioEl) {
    this.audioEl = audioEl;
    this.ctx = null;
    this.master = null;       // volume (slider)
    this.fade = null;         // timer fade — separate node so the slider's
                              // setTargetAtTime can't cancel a scheduled fade
    this.current = null;      // { id, node, gain }
    this.buffers = new Map(); // id -> AudioBuffer (loop-ready)
    this.volume = 0.8;
    this.playing = false;
    this.onchange = null;     // UI callback
    // Sleep timer
    this.timerMinutes = 0;    // 0 = Off (play until stopped)
    this.timerEndsAt = null;  // wall-clock ms, for the UI countdown
    this.timerTimeout = null;
    this.fadeSeconds = 15;    // SPEC fade length; tests may shorten
  }

  // Must be called from a user gesture the first time (iOS requirement).
  async ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * this.volume;
      this.fade = this.ctx.createGain();
      const dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.fade);
      this.fade.connect(dest);
      this.audioEl.srcObject = dest.stream;
      await this.ctx.audioWorklet.addModule(new URL('./noise-worklet.js', import.meta.url));
      this.initMediaSession();
      // Timer chosen before the first tap? Arm it now that audio exists.
      if (this.timerMinutes > 0) this.setTimer(this.timerMinutes);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  // ---- Media Session (lock-screen metadata + controls) ----
  initMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => this.resume());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
  }

  updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    if (this.current) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: SOUNDS[this.current.id].label,
        artist: 'Sound Machine',
        artwork: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
    }
    navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
  }

  // ---- Sleep timer: Off/15/30/60/90. The 15 s fade is *scheduled on the
  // audio clock* at arm time, so it fires even if iOS throttles JS timers
  // while the screen is locked. The wall-clock timeout just cleans up. ----
  setTimer(minutes) {
    this.timerMinutes = minutes;
    if (this.timerTimeout) { clearTimeout(this.timerTimeout); this.timerTimeout = null; }
    this.timerEndsAt = null;
    if (this.fade) {
      const now = this.ctx.currentTime;
      this.fade.gain.cancelScheduledValues(now);
      this.fade.gain.setValueAtTime(1, now);
      if (minutes > 0) {
        const total = minutes * 60;
        const fadeStart = now + Math.max(total - this.fadeSeconds, 0);
        this.fade.gain.setValueAtTime(1, fadeStart);
        this.fade.gain.linearRampToValueAtTime(0.0001, fadeStart + Math.min(this.fadeSeconds, total));
        this.timerEndsAt = Date.now() + total * 1000;
        this.timerTimeout = setTimeout(() => this.timerExpired(), total * 1000 + 500);
      }
    }
    // if there's no audio context yet, ensureContext() arms it on first tap
    this.emit();
  }

  async timerExpired() {
    this.timerTimeout = null;
    this.timerEndsAt = null;
    this.timerMinutes = 0;
    if (this.playing) await this.pause();
    if (this.fade) { // silently restore for the next play
      this.fade.gain.cancelScheduledValues(this.ctx.currentTime);
      this.fade.gain.setValueAtTime(1, this.ctx.currentTime);
    }
    this.emit();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) {
      // v^2 for a roughly perceptual slider curve
      this.master.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.02);
    }
  }

  // Select a sound: stops whatever is playing, starts this one.
  async select(id) {
    await this.ensureContext();
    this.stopCurrent();

    const spec = SOUNDS[id];
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    let node;
    if (spec.kind === 'noise') {
      node = new AudioWorkletNode(this.ctx, 'noise-processor', {
        numberOfInputs: 0,
        outputChannelCount: [1],
        processorOptions: { type: id },
      });
    } else {
      const buffer = await this.loadLoopBuffer(id, spec.src);
      node = this.ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
    }
    node.connect(gain);
    if (spec.kind === 'file') node.start();

    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + SWITCH_FADE);

    this.current = { id, node, gain };
    this.playing = true;
    await this.audioEl.play();
    this.updateMediaSession();
    this.emit();
  }

  stopCurrent() {
    if (!this.current) return;
    const { node, gain } = this.current;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, SWITCH_FADE / 3);
    setTimeout(() => {
      if (node.port) node.port.postMessage('stop'); // worklet ends itself
      else node.stop();
      node.disconnect();
      gain.disconnect();
    }, SWITCH_FADE * 1000 + 50);
    this.current = null;
  }

  async pause() {
    if (!this.current) return;
    this.playing = false;
    this.audioEl.pause();
    await this.ctx.suspend();
    this.updateMediaSession();
    this.emit();
  }

  async resume() {
    if (!this.current) return;
    await this.ctx.resume();
    await this.audioEl.play();
    this.playing = true;
    this.updateMediaSession();
    this.emit();
  }

  async toggle() {
    if (this.playing) await this.pause();
    else await this.resume();
  }

  emit() { if (this.onchange) this.onchange(this); }

  // Fetch + decode a file, then make it loop-ready in memory:
  // 1) trim near-silent edges (AAC encoder padding),
  // 2) equal-power-crossfade the tail into the head so sample N-1 flows into
  //    sample 0 with no discontinuity, regardless of codec behavior.
  async loadLoopBuffer(id, src) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`);
    const decoded = await this.ctx.decodeAudioData(await res.arrayBuffer());
    const buffer = makeSeamlessLoop(this.ctx, decoded);
    this.buffers.set(id, buffer);
    return buffer;
  }
}

function makeSeamlessLoop(ctx, decoded) {
  const rate = decoded.sampleRate;
  const channels = decoded.numberOfChannels;
  const data = [];
  for (let c = 0; c < channels; c++) data.push(decoded.getChannelData(c));

  // Trim leading/trailing silence (codec padding)
  let start = 0, end = decoded.length;
  const isSilent = (i) => {
    for (let c = 0; c < channels; c++) if (Math.abs(data[c][i]) > SILENCE_THRESHOLD) return false;
    return true;
  };
  while (start < end && isSilent(start)) start++;
  while (end > start && isSilent(end - 1)) end--;

  const xfade = Math.min(Math.floor(LOOP_XFADE * rate), Math.floor((end - start) / 4));
  const outLen = (end - start) - xfade;
  const out = ctx.createBuffer(channels, outLen, rate);

  for (let c = 0; c < channels; c++) {
    const src = data[c];
    const dst = out.getChannelData(c);
    for (let i = 0; i < outLen; i++) dst[i] = src[start + i];
    // Blend the trimmed-off tail into the head (equal-power)
    for (let i = 0; i < xfade; i++) {
      const p = i / xfade;
      const fadeIn = Math.sin(p * Math.PI / 2);
      const fadeOut = Math.cos(p * Math.PI / 2);
      dst[i] = dst[i] * fadeIn + src[start + outLen + i] * fadeOut;
    }
  }
  return out;
}
