/**
 * Enigma I Simulation Engine + x86-64 Assembly Disassembly Tracer
 * Universal implementation: supports arbitrary text, positions, rings, rotors, and steckers.
 */

export const ROTOR_DEFS = {
  'I':   { name: 'I',   wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  'II':  { name: 'II',  wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  'III': { name: 'III', wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' }
};

export const REFLECTOR_DEFS = {
  'B': { name: 'B', wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT' }
};

// Casino reel symbols mapping to letters for slot machine mode
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

  /**
   * Accurate mechanical double-stepping logic:
   */
  step() {
    const notchMid = this.rotors[1].notch.charCodeAt(0) - 65;
    const notchRight = this.rotors[2].notch.charCodeAt(0) - 65;

    const midAtNotch = this.pos[1] === notchMid;
    const rightAtNotch = this.pos[2] === notchRight;

    let doubleStepped = false;
    if (midAtNotch) {
      this.pos[0] = (this.pos[0] + 1) % 26;
      this.pos[1] = (this.pos[1] + 1) % 26;
      doubleStepped = true;
    } else if (rightAtNotch) {
      this.pos[1] = (this.pos[1] + 1) % 26;
    }

    this.pos[2] = (this.pos[2] + 1) % 26;
    this.positions = this.getPositions();
    return { midAtNotch, rightAtNotch, doubleStepped };
  }

  /**
   * Encipher single character + generate ASM instructions
   */
  processChar(ch) {
    const upper = ch.toUpperCase();
    if (upper < 'A' || upper > 'Z') {
      return {
        input: ch,
        output: ch,
        stepped: false,
        trace: null,
        asm: null,
        positions: this.getPositions()
      };
    }

    const stepInfo = this.step();
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

    // Generate real x86-64 assembly snippet for this operation
    const asm = [
      `;; --- Enigma I Cipher Cycle: '${upper}' -> '${finalChar}' ---`,
      `movzx eax, byte ptr [rsi]         ; al = '${upper}' (0x${upper.charCodeAt(0).toString(16)})`,
      `sub   eax, 0x41                  ; normalize A-Z to 0..25`,
      `inc   byte ptr [r12 + 2]         ; r12 = rotor_pos, step right rotor -> ${currentPositions[2]}`,
      stepInfo.doubleStepped 
        ? `inc   byte ptr [r12 + 1]         ; DOUBLE STEP! mid rotor -> ${currentPositions[1]}\ninc   byte ptr [r12 + 0]         ; left rotor advanced -> ${currentPositions[0]}`
        : stepInfo.rightAtNotch 
          ? `inc   byte ptr [r12 + 1]         ; right notch trip! mid rotor -> ${currentPositions[1]}` 
          : `; no notch trigger on middle rotor`,
      `mov   al, byte ptr [stecker + rax] ; plugboard in -> '${trace.plugboardIn}'`,
      `add   al, byte ptr [r12 + 2]      ; rotor III offset (+${this.pos[2]})`,
      `mov   al, byte ptr [rotor3 + rax]  ; forward III -> '${trace.forwardR}'`,
      `mov   al, byte ptr [rotor2 + rax]  ; forward II -> '${trace.forwardM}'`,
      `mov   al, byte ptr [rotor1 + rax]  ; forward I -> '${trace.forwardL}'`,
      `mov   al, byte ptr [ukw_b + rax]   ; reflector UKW-B -> '${trace.reflector}'`,
      `mov   al, byte ptr [inv_r1 + rax]  ; backward I -> '${trace.backwardL}'`,
      `mov   al, byte ptr [inv_r2 + rax]  ; backward II -> '${trace.backwardM}'`,
      `mov   al, byte ptr [inv_r3 + rax]  ; backward III -> '${trace.backwardR}'`,
      `mov   al, byte ptr [stecker + rax] ; plugboard out -> '${trace.plugboardOut}'`,
      `add   eax, 0x41                  ; restore ASCII -> '${finalChar}'`,
      `mov   byte ptr [rdi], al         ; store ciphertext byte`
    ].join('\n');

    return {
      input: ch,
      output: finalChar,
      stepped: true,
      trace,
      asm,
      positions: currentPositions
    };
  }

  processText(text, startPos) {
    if (startPos) {
      this.setPositions(startPos);
    }
    let result = '';
    const traces = [];
    const asmLogs = [];
    for (let i = 0; i < text.length; i++) {
      const res = this.processChar(text[i]);
      result += res.output;
      if (res.trace) traces.push(res.trace);
      if (res.asm) asmLogs.push(res.asm);
    }
    return {
      text: result,
      traces,
      asmLogs,
      finalPositions: this.getPositions()
    };
  }
}
