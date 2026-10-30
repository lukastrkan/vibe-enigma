import { EnigmaMachine, CASINO_SYMBOLS } from './enigma.js';
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
let isSpinning = false;

// DOM Elements
const rotorVals = [
  document.getElementById('rotor-val-0'),
  document.getElementById('rotor-val-1'),
  document.getElementById('rotor-val-2')
];
const reelSyms = [
  document.getElementById('reel-sym-0'),
  document.getElementById('reel-sym-1'),
  document.getElementById('reel-sym-2')
];
const reelStrips = [
  document.getElementById('reel-strip-0'),
  document.getElementById('reel-strip-1'),
  document.getElementById('reel-strip-2')
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

// Slot Machine & ASM Elements
const slotLeverAssembly = document.getElementById('slot-lever-assembly');
const leverShaft = document.getElementById('lever-shaft');
const btnSpinSlots = document.getElementById('btn-spin-slots');
const btnModeCasino = document.getElementById('btn-mode-casino');
const btnModeAsm = document.getElementById('btn-mode-asm');
const asmPanel = document.getElementById('asm-panel');
const asmCodeView = document.getElementById('asm-code-view');
const asmRegisters = document.getElementById('asm-registers');

// Update UI Rotor & Slot Reel Display
function updateRotorUI() {
  const currentPos = machine.getPositions();
  for (let i = 0; i < 3; i++) {
    const letter = currentPos[i];
    if (rotorVals[i]) rotorVals[i].textContent = letter;
    if (reelSyms[i]) reelSyms[i].textContent = CASINO_SYMBOLS[letter] || '🎰';
  }
}

// Flash Lamp
let lampTimeout = null;
function flashLamp(char) {
  const upper = char.toUpperCase();
  const lamp = lampElements[upper];
  if (!lamp) return;

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

// Update ASM CPU Registers & View
function updateAsmUI(res) {
  if (!res || !res.asm) return;
  const pos = machine.getPositions();
  const upper = res.input.toUpperCase();
  const out = res.output;

  asmRegisters.innerHTML = `
    <span class="reg">RAX: 0x${out.charCodeAt(0).toString(16).padStart(8, '0')}</span>
    <span class="reg">RBX: 0x00000010</span>
    <span class="reg">R12: ['${pos[0]}','${pos[1]}','${pos[2]}']</span>
    <span class="reg">RSI: &amp;'${upper}'</span>
    <span class="reg">RDI: &amp;'${out}'</span>
    <span class="reg">FLAGS: [CF=0, ZF=${out === upper ? 1 : 0}, SF=0]</span>
  `;

  asmCodeView.textContent = res.asm;
}

// Handle Single Character Keypress
function handleCharInput(char) {
  const res = machine.processChar(char);
  sound.playKeyClick();
  if (res.stepped) {
    updateRotorUI();
    flashLamp(res.output);
    updateTraceUI(res.trace);
    updateAsmUI(res);
  }
  return res.output;
}

// Slot Machine Spin Animation
async function spinSlotReels(targetPos = null) {
  if (isSpinning) return;
  isSpinning = true;

  sound.playLeverPull();
  leverShaft.classList.add('pulled');
  setTimeout(() => leverShaft.classList.remove('pulled'), 250);

  // Start spinning all 3 reels
  reelStrips.forEach(strip => strip.classList.add('spinning'));

  let ticks = 0;
  const tickInterval = setInterval(() => {
    sound.playReelTick(0.8 + Math.random() * 0.4);
    ticks++;
  }, 70);

  // Stop Reel 1, 2, 3 sequentially
  const finalPos = targetPos || [
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ].join('');

  setTimeout(() => {
    reelStrips[0].classList.remove('spinning');
    sound.playReelStop();
    rotorVals[0].textContent = finalPos[0];
    reelSyms[0].textContent = CASINO_SYMBOLS[finalPos[0]] || '🎰';
  }, 600);

  setTimeout(() => {
    reelStrips[1].classList.remove('spinning');
    sound.playReelStop();
    rotorVals[1].textContent = finalPos[1];
    reelSyms[1].textContent = CASINO_SYMBOLS[finalPos[1]] || '🎰';
  }, 950);

  setTimeout(() => {
    reelStrips[2].classList.remove('spinning');
    clearInterval(tickInterval);
    sound.playReelStop();
    rotorVals[2].textContent = finalPos[2];
    reelSyms[2].textContent = CASINO_SYMBOLS[finalPos[2]] || '🎰';
    machine.setPositions(finalPos);
    isSpinning = false;
    sound.playJackpot();
  }, 1300);
}

// Parse Agenda String
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
            <span class="rotor-chip">${t.start[0]} ${CASINO_SYMBOLS[t.start[0]] || ''}</span>
            <span class="rotor-chip">${t.start[1]} ${CASINO_SYMBOLS[t.start[1]] || ''}</span>
            <span class="rotor-chip">${t.start[2]} ${CASINO_SYMBOLS[t.start[2]] || ''}</span>
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
          <button class="btn-load-enigma" data-start="${t.start}" data-cipher="${encodeURIComponent(t.ciphertext)}">🎰 Pull &amp; Decode</button>
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

      // Trigger Casino spin to target start setting!
      spinSlotReels(start);

      studioInput.value = cipher;
      setTimeout(() => {
        const result = machine.processText(cipher, start);
        studioOutput.value = result.text;
        if (result.traces.length > 0) {
          updateTraceUI(result.traces[result.traces.length - 1]);
        }
        if (result.asmLogs.length > 0) {
          asmCodeView.textContent = result.asmLogs[0];
        }
      }, 1350);
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

// Setup Reel Stepper Buttons
document.querySelectorAll('.reel-step-btn').forEach(btn => {
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
    sound.playReelTick(1.0);
  });
});

// Setup Presets
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = btn.dataset.preset;
    spinSlotReels(preset);
  });
});

// Slot Lever Pull Click
slotLeverAssembly.addEventListener('click', () => {
  spinSlotReels();
});

btnSpinSlots.addEventListener('click', () => {
  spinSlotReels();
});

// Mode Switcher Tabs
btnModeCasino.addEventListener('click', () => {
  btnModeCasino.classList.add('active');
  btnModeAsm.classList.remove('active');
  asmPanel.style.display = 'none';
});

btnModeAsm.addEventListener('click', () => {
  btnModeAsm.classList.add('active');
  btnModeCasino.classList.remove('active');
  asmPanel.style.display = 'flex';
});

// Virtual Keyboard
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
  const res = machine.processText(input);
  studioOutput.value = res.text;
  updateRotorUI();
  if (res.traces.length > 0) {
    updateTraceUI(res.traces[res.traces.length - 1]);
  }
  if (res.asmLogs.length > 0) {
    asmCodeView.textContent = res.asmLogs[0];
  }
  sound.playJackpot();
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
