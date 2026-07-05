import { Engine, SOUNDS } from './engine.js';

const audioEl = document.getElementById('audio-el');
const grid = document.getElementById('sound-grid');
const playPauseBtn = document.getElementById('play-pause');
const volumeSlider = document.getElementById('volume');
const statusEl = document.getElementById('status');

const engine = new Engine(audioEl);
const buttons = new Map();

for (const [id, spec] of Object.entries(SOUNDS)) {
  const btn = document.createElement('button');
  btn.className = 'sound-btn';
  btn.textContent = spec.label;
  btn.addEventListener('click', () => onSoundTap(id));
  grid.appendChild(btn);
  buttons.set(id, btn);
}

async function onSoundTap(id) {
  try {
    if (engine.current && engine.current.id === id) {
      await engine.toggle(); // tapping the active sound pauses/resumes it
    } else {
      statusEl.textContent = SOUNDS[id].kind === 'file' && !engine.buffers.has(id) ? 'Loading…' : '';
      await engine.select(id);
      statusEl.textContent = '';
    }
  } catch (err) {
    statusEl.textContent = `Couldn't play ${SOUNDS[id].label}: ${err.message}`;
  }
}

playPauseBtn.addEventListener('click', () => engine.toggle());

volumeSlider.addEventListener('input', () => {
  engine.setVolume(parseFloat(volumeSlider.value));
});

engine.onchange = () => {
  const currentId = engine.current ? engine.current.id : null;
  for (const [id, btn] of buttons) {
    btn.classList.toggle('active', id === currentId);
    btn.classList.toggle('paused', id === currentId && !engine.playing);
  }
  playPauseBtn.disabled = !currentId;
  playPauseBtn.textContent = engine.playing ? 'Pause' : 'Play';
};

engine.setVolume(parseFloat(volumeSlider.value));

// Debug/testing hook (used by automated checks; harmless in production)
window.__engine = engine;
