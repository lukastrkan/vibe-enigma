/**
 * Universal Enigma I Simulation Engine
 * Calibrated for DevFest Prague 2026 Vibe Lounge broadcast
 */

export const ROTOR_DEFS = {
  'I':   { name: 'I',   wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  'II':  { name: 'II',  wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  'III': { name: 'III', wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' }
};

export const REFLECTOR_DEFS = {
  'B': { name: 'B', wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT' }
};

export const CASINO_SYMBOLS = {
  'A': '🍒', 'B': '🍋', 'C': '🍊', 'D': '🍇', 'E': '🔔',
  'F': '💎', 'G': '⭐', 'H': '7️⃣', 'I': '🎰', 'J': '🍀',
  'K': '💰', 'L': '👑', 'M': '🃏', 'N': '🎲', 'O': '🍉',
  'P': '🪙', 'Q': '🍸', 'R': '🎯', 'S': '⚡', 'T': '🔥',
  'U': '🎩', 'V': '🍺', 'W': '🚀', 'X': '🧨', 'Y': '🏆', 'Z': '🥇'
};

export class EnigmaMachine {
  constructor(options = {}) {
    this.rotorNames = options.rotors || ['I', 'II', 'III'];
    this.reflectorName = options.reflector || 'B';
    this.rings = options.rings || 'AAA';
    this.plugboard = options.plugboard || ['DE', 'VF', 'ST'];
    this.positions = options.positions || 'AAA';

    this.reconfigure();
  }

  reconfigure() {
    this.rotors = this.rotorNames.map(name => ROTOR_DEFS[name]);
    this.reflector = REFLECTOR_DEFS[this.reflectorName];

    this.pos = [
      this.positions.charCodeAt(0) - 65,
      this.positions.charCodeAt(1) - 65,
      this.positions.charCodeAt(2) - 65
    ];

    this.ringOffsets = [
      this.rings.charCodeAt(0) - 65,
      this.rings.charCodeAt(1) - 65,
      this.rings.charCodeAt(2) - 65
    ];

    this.plugMap = {};
    for (const pair of this.plugboard) {
      if (pair.length === 2) {
        const a = pair[0].toUpperCase();
        const b = pair[1].toUpperCase();
        this.plugMap[a] = b;
        this.plugMap[b] = a;
      }
    }
  }

  setPositions(posStr) {
    if (typeof posStr === 'string' && posStr.length >= 3) {
      this.positions = posStr.toUpperCase().slice(0, 3);
      this.pos = [
        this.positions.charCodeAt(0) - 65,
        this.positions.charCodeAt(1) - 65,
        this.positions.charCodeAt(2) - 65
      ];
    }
  }

  getPositions() {
    return String.fromCharCode(
      this.pos[0] + 65,
      this.pos[1] + 65,
      this.pos[2] + 65
    );
  }

  setPlugboard(pairs) {
    this.plugboard = Array.isArray(pairs) ? pairs : [];
    this.reconfigure();
  }

  step() {
    const notchMid = this.rotors[1].notch.charCodeAt(0) - 65;
    const notchRight = this.rotors[2].notch.charCodeAt(0) - 65;

    const midAtNotch = this.pos[1] === notchMid;
    const rightAtNotch = this.pos[2] === notchRight;

    if (midAtNotch) {
      this.pos[0] = (this.pos[0] + 1) % 26;
      this.pos[1] = (this.pos[1] + 1) % 26;
    } else if (rightAtNotch) {
      this.pos[1] = (this.pos[1] + 1) % 26;
    }

    this.pos[2] = (this.pos[2] + 1) % 26;
    this.positions = this.getPositions();
  }

  processChar(ch) {
    const upper = ch.toUpperCase();
    if (upper < 'A' || upper > 'Z') {
      return {
        input: ch,
        output: ch,
        stepped: false,
        trace: null,
        positions: this.getPositions()
      };
    }

    this.step();
    const currentPositions = this.getPositions();

    const trace = {
      raw: upper,
      plugboardIn: '',
      forwardR: '',
      forwardM: '',
      forwardL: '',
      reflector: '',
      backwardL: '',
      backwardM: '',
      backwardR: '',
      plugboardOut: '',
      final: ''
    };

    // 1. Plugboard entry
    let c = this.plugMap[upper] || upper;
    trace.plugboardIn = c;
    let idx = c.charCodeAt(0) - 65;

    // 2. Forward through rotors: Right (2), Middle (1), Left (0)
    for (const r of [2, 1, 0]) {
      const p = this.pos[r];
      const ring = this.ringOffsets[r];
      const pin = (idx + p - ring + 26) % 26;
      const contact = this.rotors[r].wiring.charCodeAt(pin) - 65;
      idx = (contact - p + ring + 26) % 26;

      if (r === 2) trace.forwardR = String.fromCharCode(idx + 65);
      else if (r === 1) trace.forwardM = String.fromCharCode(idx + 65);
      else trace.forwardL = String.fromCharCode(idx + 65);
    }

    // 3. Reflector
    idx = this.reflector.wiring.charCodeAt(idx) - 65;
    trace.reflector = String.fromCharCode(idx + 65);

    // 4. Backward through rotors: Left (0), Middle (1), Right (2)
    for (const r of [0, 1, 2]) {
      const p = this.pos[r];
      const ring = this.ringOffsets[r];
      const pin = (idx + p - ring + 26) % 26;
      const contact = this.rotors[r].wiring.indexOf(String.fromCharCode(pin + 65));
      idx = (contact - p + ring + 26) % 26;

      if (r === 0) trace.backwardL = String.fromCharCode(idx + 65);
      else if (r === 1) trace.backwardM = String.fromCharCode(idx + 65);
      else trace.backwardR = String.fromCharCode(idx + 65);
    }

    // 5. Plugboard exit
    const unsteckered = String.fromCharCode(idx + 65);
    const finalChar = this.plugMap[unsteckered] || unsteckered;
    trace.plugboardOut = finalChar;
    trace.final = finalChar;

    return {
      input: ch,
      output: finalChar,
      stepped: true,
      trace,
      positions: currentPositions
    };
  }

  processText(text, startPos) {
    if (startPos) {
      this.setPositions(startPos);
    }
    let result = '';
    const traces = [];
    for (let i = 0; i < text.length; i++) {
      const res = this.processChar(text[i]);
      result += res.output;
      if (res.trace) traces.push(res.trace);
    }
    return {
      text: result,
      traces,
      finalPositions: this.getPositions()
    };
  }
}
