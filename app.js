import { EnigmaMachine } from './enigma.js';
import { sound } from './audio.js';

// Configuration
const API_BASE = 'https://devfest-vibe-lounge.web.app/api';
let machine = new EnigmaMachine({
  rotors: ['I', 'II', 'III'],
  reflector: 'B',
  rings: 'AAA',
  plugboard: ['DE', 'VF', 'ST'],
  positions: 'AAA'
});

let transmissionsData = [];
let nextSyncSeconds = 10;
let syncTimerInterval = null;

// DOM Elements
const rotorVals = [
  document.getElementById('rotor-val-0'),
  document.getElementById('rotor-val-1'),
  document.getElementById('rotor-val-2')
];
const lampElements = {};
document.querySelectorAll('.lamp').forEach(el => {
  lampElements[el.dataset.char] = el;
});

const keyElements = {};
document.querySelectorAll('.key').forEach(el => {
  keyElements[el.dataset.char] = el;
});

const traceDisplay = document.getElementById('trace-display');
const transmissionsFeed = document.getElementById('transmissions-feed');
const transmissionsCount = document.getElementById('transmissions-count');
const agendaFilter = document.getElementById('agenda-filter');
const syncTimer = document.getElementById('sync-timer');
const btnManualSync = document.getElementById('btn-manual-sync');
const liveClock = document.getElementById('live-clock');
const soundToggle = document.getElementById('sound-toggle');

const studioInput = document.getElementById('studio-input');
const studioOutput = document.getElementById('studio-output');
const btnRunStudio = document.getElementById('btn-run-studio');
const btnClearStudio = document.getElementById('btn-clear-studio');

const activePlugsEl = document.getElementById('active-plugs');
const plugInputPairs = document.getElementById('plug-input-pairs');
const btnUpdatePlugs = document.getElementById('btn-update-plugs');

const submitModal = document.getElementById('submit-modal');
const btnOpenSubmit = document.getElementById('btn-open-submit');
const btnCloseModal = document.getElementById('btn-close-modal');
const leaderboardForm = document.getElementById('leaderboard-form');
const submitFeedback = document.getElementById('submit-feedback');
const submitUrlField = document.getElementById('submit-url');

// Update UI Rotor Display
function updateRotorUI() {
  const currentPos = machine.getPositions();
  for (let i = 0; i < 3; i++) {
    if (rotorVals[i]) {
      rotorVals[i].textContent = currentPos[i];
    }
  }
}

// Flash Lamp
let lampTimeout = null;
function flashLamp(char) {
  const upper = char.toUpperCase();
  const lamp = lampElements[upper];
  if (!lamp) return;

  // Clear any existing lit lamp
  document.querySelectorAll('.lamp.lit').forEach(l => l.classList.remove('lit'));

  lamp.classList.add('lit');
  if (lampTimeout) clearTimeout(lampTimeout);
  lampTimeout = setTimeout(() => {
    lamp.classList.remove('lit');
  }, 350);
}

// Update Electrical Trace
function updateTraceUI(trace) {
  if (!trace) return;
  traceDisplay.innerHTML = `
    <span class="trace-step trace-in">IN: ${trace.raw}</span> &rarr;
    <span class="trace-step">STECK: ${trace.plugboardIn}</span> &rarr;
    <span class="trace-step">R3: ${trace.forwardR}</span> &rarr;
    <span class="trace-step">R2: ${trace.forwardM}</span> &rarr;
    <span class="trace-step">R1: ${trace.forwardL}</span> &rarr;
    <span class="trace-step trace-reflector">UKW: ${trace.reflector}</span> &rarr;
    <span class="trace-step">R1: ${trace.backwardL}</span> &rarr;
    <span class="trace-step">R2: ${trace.backwardM}</span> &rarr;
    <span class="trace-step">R3: ${trace.backwardR}</span> &rarr;
    <span class="trace-step">STECK: ${trace.plugboardOut}</span> &rarr;
    <span class="trace-step trace-out">LAMP: ${trace.final}</span>
  `;
}

// Handle Single Character Keypress
function handleCharInput(char) {
  const res = machine.processChar(char);
  sound.playKeyClick();
  if (res.stepped) {
    sound.playRotorStep();
    updateRotorUI();
    flashLamp(res.output);
    updateTraceUI(res.trace);
  }
  return res.output;
}

// Parse Agenda String: e.g. "12:50 CRIME LAB: HACK A HUMANOID: BUILD YOUR OWN ROBOT SKILLS IN 100 MINUTES / MARTIN KRCEK"
function parseAgenda(text) {
  const pattern = /^(\d{2}:\d{2})\s+([^:]+):\s+(.+?)(?:\s+\/\s+(.+))?$/;
  const match = text.match(pattern);
  if (match) {
    return {
      time: match[1],
      room: match[2].trim(),
      title: match[3].trim(),
      speakers: match[4] ? match[4].trim() : ''
    };
  }
  return {
    time: '',
    room: '',
    title: text,
    speakers: ''
  };
}

// Decode All Transmissions & Render
function renderTransmissions() {
  const filterQuery = (agendaFilter.value || '').toLowerCase().trim();

  // Create temporary decoder instance to not disturb manual state
  const decoder = new EnigmaMachine({
    rotors: machine.rotorNames,
    reflector: machine.reflectorName,
    rings: machine.rings,
    plugboard: machine.plugboard
  });

  const cardsHtml = transmissionsData.map((t, idx) => {
    const decodedText = decoder.processText(t.ciphertext, t.start).text;
    const parsed = parseAgenda(decodedText);

    const matches = !filterQuery || 
      decodedText.toLowerCase().includes(filterQuery) ||
      t.ciphertext.toLowerCase().includes(filterQuery) ||
      String(t.number).includes(filterQuery);

    if (!matches) return '';

    const sentTime = t.sentAt ? new Date(t.sentAt).toLocaleTimeString() : '';

    return `
      <div class="transmission-card ${idx === 0 ? 'latest' : ''}" data-number="${t.number}">
        <div class="t-meta-bar">
          <div class="t-num-wrap">
            <span class="t-num">N° ${t.number}</span>
            <span class="t-time">${sentTime}</span>
          </div>
          <div class="t-rotors">
            <span>Rotor start:</span>
            <span class="rotor-chip">${t.start[0]}</span>
            <span class="rotor-chip">${t.start[1]}</span>
            <span class="rotor-chip">${t.start[2]}</span>
          </div>
        </div>

        <div class="t-decoded">
          <div class="t-tag-row">
            ${parsed.time ? `<span class="badge-time">${parsed.time}</span>` : ''}
            ${parsed.room ? `<span class="badge-room">${parsed.room}</span>` : ''}
          </div>
          <div class="t-title">${parsed.title}</div>
          ${parsed.speakers ? `<div class="t-speakers">&bull; ${parsed.speakers}</div>` : ''}
        </div>

        <div class="t-cipher-raw">
          <code>${t.ciphertext}</code>
          <button class="btn-load-enigma" data-start="${t.start}" data-cipher="${encodeURIComponent(t.ciphertext)}">Load in Enigma</button>
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  transmissionsFeed.innerHTML = cardsHtml || '<div class="feed-empty">No matching transmissions found.</div>';
  transmissionsCount.textContent = `${transmissionsData.length} intercepted`;

  // Attach Load Button listeners
  document.querySelectorAll('.btn-load-enigma').forEach(btn => {
    btn.addEventListener('click', () => {
      const start = btn.dataset.start;
      const cipher = decodeURIComponent(btn.dataset.cipher);
      machine.setPositions(start);
      updateRotorUI();
      studioInput.value = cipher;
      // Auto run in studio
      const result = machine.processText(cipher, start);
      studioOutput.value = result.text;
      if (result.traces.length > 0) {
        updateTraceUI(result.traces[result.traces.length - 1]);
      }
      sound.playKeyClick();
    });
  });
}

// Fetch Transmissions from API
async function fetchTransmissions() {
  try {
    const res = await fetch(`${API_BASE}/transmissions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.transmissions)) {
      transmissionsData = data.transmissions;
      renderTransmissions();
    }
  } catch (err) {
    console.error('Failed to fetch transmissions:', err);
  }
}

// Countdown loop
function startSyncTimer() {
  if (syncTimerInterval) clearInterval(syncTimerInterval);
  nextSyncSeconds = 10;
  syncTimer.textContent = `Syncing in ${nextSyncSeconds}s`;

  syncTimerInterval = setInterval(() => {
    nextSyncSeconds--;
    if (nextSyncSeconds <= 0) {
      nextSyncSeconds = 10;
      fetchTransmissions();
    }
    syncTimer.textContent = `Syncing in ${nextSyncSeconds}s`;
  }, 1000);
}

// Live Clock
setInterval(() => {
  const now = new Date();
  liveClock.textContent = now.toTimeString().split(' ')[0];
}, 1000);

// Setup Rotor Buttons
document.querySelectorAll('.rotor-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const rotorIdx = parseInt(btn.dataset.rotor, 10);
    const action = btn.dataset.action;
    const currentPos = machine.getPositions();
    let charCode = currentPos.charCodeAt(rotorIdx) - 65;

    if (action === 'up') {
      charCode = (charCode + 1) % 26;
    } else {
      charCode = (charCode - 1 + 26) % 26;
    }

    const newChar = String.fromCharCode(charCode + 65);
    const newPos = currentPos.slice(0, rotorIdx) + newChar + currentPos.slice(rotorIdx + 1);
    machine.setPositions(newPos);
    updateRotorUI();
    sound.playRotorStep();
  });
});

// Setup Rotor Presets
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = btn.dataset.preset;
    machine.setPositions(preset);
    updateRotorUI();
    sound.playRotorStep();
  });
});

// Setup Virtual Keyboard
document.querySelectorAll('.key').forEach(keyEl => {
  keyEl.addEventListener('click', () => {
    const char = keyEl.dataset.char;
    keyEl.classList.add('pressed');
    setTimeout(() => keyEl.classList.remove('pressed'), 120);
    handleCharInput(char);
  });
});

// Physical Keyboard Listener
window.addEventListener('keydown', (e) => {
  // Ignore if user is typing in textarea or input
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

  const key = e.key.toUpperCase();
  if (key >= 'A' && key <= 'Z') {
    const keyEl = keyElements[key];
    if (keyEl) {
      keyEl.classList.add('pressed');
      setTimeout(() => keyEl.classList.remove('pressed'), 120);
    }
    handleCharInput(key);
  }
});

// Sound Toggle
soundToggle.addEventListener('click', () => {
  const isMuted = sound.toggleMute();
  soundToggle.textContent = isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
});

// Manual Sync
btnManualSync.addEventListener('click', () => {
  fetchTransmissions();
  startSyncTimer();
});

// Filter
agendaFilter.addEventListener('input', () => {
  renderTransmissions();
});

// Studio Actions
btnRunStudio.addEventListener('click', () => {
  const input = studioInput.value;
  const currentPos = machine.getPositions();
  const res = machine.processText(input);
  studioOutput.value = res.text;
  updateRotorUI();
  if (res.traces.length > 0) {
    updateTraceUI(res.traces[res.traces.length - 1]);
  }
  sound.playKeyClick();
});

btnClearStudio.addEventListener('click', () => {
  studioInput.value = '';
  studioOutput.value = '';
});

// Plugboard Editor
btnUpdatePlugs.addEventListener('click', () => {
  const raw = plugInputPairs.value.trim().toUpperCase();
  const pairs = raw.split(/\s+/).filter(p => p.length === 2);
  machine.setPlugboard(pairs);

  activePlugsEl.innerHTML = pairs.map(p => `
    <span class="plug-tag">${p[0]} &harr; ${p[1]}</span>
  `).join('');

  sound.playKeyClick();
});

// Modal Logic
btnOpenSubmit.addEventListener('click', () => {
  submitModal.style.display = 'flex';
  if (window.location.origin && window.location.origin.startsWith('http')) {
    submitUrlField.value = window.location.href;
  }
});

btnCloseModal.addEventListener('click', () => {
  submitModal.style.display = 'none';
});

submitModal.addEventListener('click', (e) => {
  if (e.target === submitModal) submitModal.style.display = 'none';
});

leaderboardForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const team = document.getElementById('submit-team').value.trim();
  const url = document.getElementById('submit-url').value.trim();
  const btn = document.getElementById('btn-transmit-entry');

  btn.disabled = true;
  submitFeedback.className = 'submit-feedback';
  submitFeedback.textContent = 'Transmitting to DevFest board...';

  try {
    const res = await fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, url })
    });

    if (res.ok) {
      submitFeedback.className = 'submit-feedback ok';
      submitFeedback.textContent = '✓ Received! Your decoder is live on the lounge board.';
      setTimeout(() => {
        submitModal.style.display = 'none';
      }, 2500);
    } else {
      const data = await res.json().catch(() => ({}));
      submitFeedback.className = 'submit-feedback err';
      submitFeedback.textContent = data.error || 'Failed to transmit entry.';
    }
  } catch (err) {
    submitFeedback.className = 'submit-feedback err';
    submitFeedback.textContent = 'No signal. Could not reach server.';
  } finally {
    btn.disabled = false;
  }
});

// Initial boot
updateRotorUI();
fetchTransmissions();
startSyncTimer();
