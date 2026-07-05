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

// Sleep timer selector (Off / 15 / 30 / 60 / 90)
const timerButtons = [...document.querySelectorAll('.tmr')];
for (const btn of timerButtons) {
  btn.addEventListener('click', () => engine.setTimer(parseInt(btn.dataset.min, 10)));
}

function timerStatusText() {
  if (!engine.timerEndsAt) return '';
  const mins = Math.max(0, Math.ceil((engine.timerEndsAt - Date.now()) / 60000));
  return mins > 1 ? `Stops in about ${mins} minutes` : 'Stopping soon';
}
setInterval(() => { statusEl.textContent = timerStatusText(); }, 15000);

engine.onchange = () => {
  const currentId = engine.current ? engine.current.id : null;
  for (const [id, btn] of buttons) {
    btn.classList.toggle('active', id === currentId);
    btn.classList.toggle('paused', id === currentId && !engine.playing);
  }
  playPauseBtn.disabled = !currentId;
  playPauseBtn.textContent = engine.playing ? 'Pause' : 'Play';
  for (const btn of timerButtons) {
    btn.classList.toggle('active', parseInt(btn.dataset.min, 10) === engine.timerMinutes);
  }
  statusEl.textContent = timerStatusText();
};

engine.setVolume(parseFloat(volumeSlider.value));

// Debug/testing hook (used by automated checks; harmless in production)
window.__engine = engine;
