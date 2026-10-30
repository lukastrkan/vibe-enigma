import { EnigmaMachine, CASINO_SYMBOLS } from './enigma.js';
import { sound } from './audio.js';

// Machine Configuration
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
let credits = 777;

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
const syncTimer = document.getElementById('sync-timer');
const btnManualSync = document.getElementById('btn-manual-sync');
const liveClock = document.getElementById('live-clock');
const soundToggle = document.getElementById('sound-toggle');
const creditsNum = document.getElementById('credits-num');

const studioInput = document.getElementById('studio-input');
const studioOutput = document.getElementById('studio-output');
const btnRunStudio = document.getElementById('btn-run-studio');
const btnCopyOutput = document.getElementById('btn-copy-output');

const slotLeverAssembly = document.getElementById('slot-lever-assembly');
const leverStem = document.getElementById('lever-stem');
const btnSpinSlots = document.getElementById('btn-spin-slots');

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
  }, 320);
}

// Update Electrical Trace
function updateTraceUI(trace) {
  if (!trace) return;
  traceDisplay.innerHTML = `
    <span class="t-node t-in">VSTUP: ${trace.raw}</span> &rarr;
    <span class="t-node">STECKER: ${trace.plugboardIn}</span> &rarr;
    <span class="t-node">VÁLEC III: ${trace.forwardR}</span> &rarr;
    <span class="t-node">VÁLEC II: ${trace.forwardM}</span> &rarr;
    <span class="t-node">VÁLEC I: ${trace.forwardL}</span> &rarr;
    <span class="t-node t-ref">UKW-B: ${trace.reflector}</span> &rarr;
    <span class="t-node">VÁLEC I: ${trace.backwardL}</span> &rarr;
    <span class="t-node">VÁLEC II: ${trace.backwardM}</span> &rarr;
    <span class="t-node">VÁLEC III: ${trace.backwardR}</span> &rarr;
    <span class="t-node">STECKER: ${trace.plugboardOut}</span> &rarr;
    <span class="t-node t-out">ŽÁROVKA: ${trace.final}</span>
  `;
}

// Handle Single Keypress
function handleCharInput(char) {
  const res = machine.processChar(char);
  sound.playKeyClick();
  if (res.stepped) {
    updateRotorUI();
    flashLamp(res.output);
    updateTraceUI(res.trace);
  }
  return res.output;
}

// Full Mechanical Slot Reel Spin Animation
function spinSlotReels(targetPos = null, onFinish = null) {
  if (isSpinning) return;
  isSpinning = true;

  // Lever pull sound + animation
  sound.playLeverPull();
  if (leverStem) {
    leverStem.classList.add('pulled');
    setTimeout(() => leverStem.classList.remove('pulled'), 260);
  }

  // Deduct/Add Credits
  credits += 10;
  if (creditsNum) creditsNum.textContent = credits;

  // Start spinning reels
  reelStrips.forEach(strip => strip.classList.add('spinning'));

  let tickCount = 0;
  const tickInterval = setInterval(() => {
    sound.playReelTick(0.8 + Math.random() * 0.4);
    tickCount++;
  }, 70);

  // Target rotor letters
  const finalPos = targetPos || [
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ].join('');

  // Sequentially stop reels 1, 2, 3
  setTimeout(() => {
    reelStrips[0].classList.remove('spinning');
    sound.playReelStop();
    rotorVals[0].textContent = finalPos[0];
    reelSyms[0].textContent = CASINO_SYMBOLS[finalPos[0]] || '🎰';
  }, 500);

  setTimeout(() => {
    reelStrips[1].classList.remove('spinning');
    sound.playReelStop();
    rotorVals[1].textContent = finalPos[1];
    reelSyms[1].textContent = CASINO_SYMBOLS[finalPos[1]] || '🎰';
  }, 850);

  setTimeout(() => {
    reelStrips[2].classList.remove('spinning');
    clearInterval(tickInterval);
    sound.playReelStop();
    rotorVals[2].textContent = finalPos[2];
    reelSyms[2].textContent = CASINO_SYMBOLS[finalPos[2]] || '🎰';
    
    machine.setPositions(finalPos);
    isSpinning = false;
    sound.playJackpot();

    if (onFinish) onFinish(finalPos);
  }, 1200);
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

// Render Transmissions Feed in the Secondary Drawer
function renderTransmissions() {
  const decoder = new EnigmaMachine({
    rotors: machine.rotorNames,
    reflector: machine.reflectorName,
    rings: machine.rings,
    plugboard: machine.plugboard
  });

  const cardsHtml = transmissionsData.map((t, idx) => {
    const decodedText = decoder.processText(t.ciphertext, t.start).text;
    const parsed = parseAgenda(decodedText);
    const sentTime = t.sentAt ? new Date(t.sentAt).toLocaleTimeString() : '';

    return `
      <div class="feed-item ${idx === 0 ? 'latest' : ''}" data-start="${t.start}" data-cipher="${encodeURIComponent(t.ciphertext)}">
        <div class="fi-meta">
          <span class="fi-num">N° ${t.number} (${sentTime})</span>
          <span class="fi-rotors">[${t.start[0]} ${CASINO_SYMBOLS[t.start[0]] || ''}][${t.start[1]} ${CASINO_SYMBOLS[t.start[1]] || ''}][${t.start[2]} ${CASINO_SYMBOLS[t.start[2]] || ''}]</span>
        </div>
        <div class="fi-tag-row">
          ${parsed.time ? `<span class="tag-time">${parsed.time}</span>` : ''}
          ${parsed.room ? `<span class="tag-room">${parsed.room}</span>` : ''}
        </div>
        <div class="fi-decoded">${parsed.title}</div>
        <div class="fi-cta">&larr; Klikni pro roztočení automatu</div>
      </div>
    `;
  }).join('');

  transmissionsFeed.innerHTML = cardsHtml || '<div class="feed-empty">Žádné zachycené zprávy.</div>';

  // Attach click listener: loading into slot machine
  document.querySelectorAll('.feed-item').forEach(item => {
    item.addEventListener('click', () => {
      const start = item.dataset.start;
      const cipher = decodeURIComponent(item.dataset.cipher);

      studioInput.value = cipher;
      spinSlotReels(start, () => {
        const result = machine.processText(cipher, start);
        studioOutput.textContent = result.text;
        if (result.traces.length > 0) {
          updateTraceUI(result.traces[result.traces.length - 1]);
        }
      });
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
  if (syncTimer) syncTimer.textContent = `Další za ${nextSyncSeconds}s`;

  syncTimerInterval = setInterval(() => {
    nextSyncSeconds--;
    if (nextSyncSeconds <= 0) {
      nextSyncSeconds = 10;
      fetchTransmissions();
    }
    if (syncTimer) syncTimer.textContent = `Další za ${nextSyncSeconds}s`;
  }, 1000);
}

// Live Clock
setInterval(() => {
  const now = new Date();
  if (liveClock) liveClock.textContent = now.toTimeString().split(' ')[0];
}, 1000);

// Reel Adjuster Buttons (▲ / ▼)
document.querySelectorAll('.btn-reel-step').forEach(btn => {
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

// Slot Presets
document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = btn.dataset.preset;
    if (preset === 'RAND') {
      spinSlotReels();
    } else {
      spinSlotReels(preset);
    }
  });
});

// Pull Lever Click
if (slotLeverAssembly) {
  slotLeverAssembly.addEventListener('click', () => {
    spinSlotReels(null, () => {
      // Decode current input on spin finish
      const text = studioInput.value;
      if (text) {
        const result = machine.processText(text);
        studioOutput.textContent = result.text;
      }
    });
  });
}

// Spin Button Click
if (btnSpinSlots) {
  btnSpinSlots.addEventListener('click', () => {
    spinSlotReels(null, () => {
      const text = studioInput.value;
      if (text) {
        const result = machine.processText(text);
        studioOutput.textContent = result.text;
      }
    });
  });
}

// Run Studio Input
if (btnRunStudio) {
  btnRunStudio.addEventListener('click', () => {
    const text = studioInput.value;
    const result = machine.processText(text);
    studioOutput.textContent = result.text;
    updateRotorUI();
    if (result.traces.length > 0) {
      updateTraceUI(result.traces[result.traces.length - 1]);
    }
    sound.playJackpot();
  });
}

// Copy Output
if (btnCopyOutput) {
  btnCopyOutput.addEventListener('click', () => {
    const text = studioOutput.textContent;
    navigator.clipboard.writeText(text);
    btnCopyOutput.textContent = 'Zkopírováno!';
    setTimeout(() => btnCopyOutput.textContent = 'Kopírovat', 1500);
  });
}

// Virtual Keyboard Keys
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
if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    soundToggle.textContent = isMuted ? '🔇 ZVUK VYPNUT' : '🔊 ZVUK ZAPNUT';
  });
}

// Manual Sync
if (btnManualSync) {
  btnManualSync.addEventListener('click', () => {
    fetchTransmissions();
    startSyncTimer();
  });
}

// Initial Boot
updateRotorUI();
fetchTransmissions();
startSyncTimer();
