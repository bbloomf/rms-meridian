// The opening theme, synthesized with Web Audio so there are no sound files.
// It's scored like a film-orchestra main title. A harp sweeps up under a
// cymbal swell, and French horns take a farewell in the manner of "The Leaving
// of Liverpool" with the violins soaring an octave above, over string chords,
// harp ripples and timpani. At the scream (3.9s, matching .c-scream in
// style.css) the full brass breaks it off on a dissonant chord with a tam-tam.
// Then a celesta picks the tune out in G minor over tremolo low strings,
// shivering high violins and muted horns.
//
// Browsers usually refuse to start audio before the player has clicked
// anything, so the intro asks soundBlocked() first and waits for a click if
// need be. The score is also scheduled from an offset: unmuting part-way
// through starts at the matching moment instead of from the top.

const SOUND_KEY = "meridian-sound"; // not "meridian:", which main.ts prunes as saves
export const soundWanted = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};
const rememberSound = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {}
};

const audioContext = (): typeof AudioContext | undefined =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

/**
 * Whether the browser is holding sound back until the player clicks. Only
 * true if they want sound: with it turned off there's nothing to wait for.
 */
export function soundBlocked(): Promise<boolean> {
  const Ctx = audioContext();
  if (!Ctx || !soundWanted()) return Promise.resolve(false);
  const nav = navigator as Navigator & { getAutoplayPolicy?: (type: "audiocontext") => string };
  if (nav.getAutoplayPolicy) return Promise.resolve(nav.getAutoplayPolicy("audiocontext") === "disallowed");
  // Most browsers can only say by trying. A blocked resume never settles, or fails.
  const probe = new Ctx();
  const tried = probe.resume().then(() => probe.state !== "running", () => true);
  const late = new Promise<boolean>((done) => setTimeout(() => done(true), 300));
  return Promise.race([tried, late]).finally(() => void probe.close().catch(() => {}));
}

const hz = (note: string): number => {
  const [, name, acc, oct] = /^([A-G])([#b]?)(\d)$/.exec(note)!;
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[name]! + (acc === "#" ? 1 : acc === "b" ? -1 : 0);
  return 440 * 2 ** (semis / 12 + Number(oct) - 4);
};

// ── The score ─────────────────────────────────────────────────────────────

type Voice =
  | "horn" // French horns, the tune
  | "violins" // the tune an octave up, and the shiver at the end
  | "strings" // the string section's chords
  | "lowtrem" // cellos and basses, bowed tremolo
  | "hightrem" // violins, bowed tremolo near the bridge
  | "brass" // trumpets and trombones, fortissimo
  | "harp"
  | "celesta"
  | "timp"
  | "swell" // suspended cymbal rolled with soft mallets
  | "tamtam";
interface Note {
  v: Voice;
  at: number; // seconds from the start of the intro
  len: number;
  n?: string;
  vol?: number;
  pan?: number; // -1 left to 1 right; otherwise the voice's seat in the orchestra
}

/** Where each section sits on the stage. */
const SEATS: Record<Voice, number> = {
  violins: -0.45, hightrem: -0.5, harp: -0.6, celesta: -0.2, strings: 0, horn: 0.3,
  brass: 0.15, lowtrem: 0.45, timp: 0.1, swell: 0, tamtam: -0.1,
};

/** Voices whose notes are long enough to join part-way through on a late unmute. */
const SUSTAINED: Voice[] = ["strings", "lowtrem", "hightrem", "swell", "tamtam"];

const Q = 0.42; // one beat of the farewell
const T0 = 0.35; // the overlay has faded in
const TURN = 3.9; // the scream
const END = 11; // the last notes have died away
const TAIL = 4; // and so has the hall's echo of them

/** [note, beats] from a start time, one after another. */
const line = (v: Voice, from: number, beat: number, notes: [string, number][], vol?: number): Note[] => {
  let t = from;
  return notes.map(([n, b]) => {
    const note = { v, at: t, len: b * beat, n, vol };
    t += b * beat;
    return note;
  });
};

const chord = (v: Voice, at: number, len: number, notes: string[], vol?: number): Note[] => notes.map((n) => ({ v, at, len, n, vol }));

/** A harp spread upward, one string after another. */
const ripple = (at: number, notes: string[], gap = 0.05, vol?: number): Note[] =>
  notes.map((n, i) => ({ v: "harp", at: at + i * gap, len: 1.6, n, vol }));

// Pickup, then two bars ending on the dominant, where the cadence should come.
const TUNE: [string, number][] = [
  ["D4", 0.5],
  ["G4", 1], ["G4", 0.5], ["A4", 0.5], ["B4", 1], ["D5", 1],
  ["C5", 0.75], ["B4", 0.25], ["A4", 1], ["G4", 0.5], ["E4", 0.5], ["D4", 1],
];
const up = (notes: [string, number][]): [string, number][] => notes.map(([n, b]) => [n.slice(0, -1) + (Number(n.at(-1)) + 1), b]);

const BAR1 = T0 + 0.5 * Q;
const beat = (b: number) => BAR1 + b * Q;

const MAIN_TITLE: Note[] = [
  // The curtain: a cymbal swell, a harp glissando and a soft timpani stroke.
  { v: "swell", at: 0, len: BAR1, vol: 0.5 },
  ...ripple(0, ["G2", "B2", "D3", "G3", "A3", "B3", "D4", "E4", "G4", "A4", "B4", "D5"], 0.017, 0.7),
  { v: "timp", at: BAR1, len: 1.6, n: "G2", vol: 0.5 },

  ...line("horn", T0, Q, TUNE),
  ...line("violins", T0, Q, up(TUNE), 0.55),

  // G, G over B, C, E minor, D: sustained strings with the basses underneath.
  ...chord("strings", beat(0), 2 * Q, ["G1", "G2", "D3", "B3", "G4"]),
  ...chord("strings", beat(2), 2 * Q, ["B1", "B2", "D3", "G3", "D4"]),
  ...chord("strings", beat(4), 2 * Q, ["C2", "C3", "G3", "E4"]),
  ...chord("strings", beat(6), Q, ["E2", "E3", "B3", "G4"]),
  ...chord("strings", beat(7), Q + 0.05, ["D2", "D3", "A3", "F#4"], 1.15),

  ...ripple(beat(1), ["G3", "B3", "D4", "G4"], 0.06, 0.5),
  ...ripple(beat(3), ["B3", "D4", "G4", "B4"], 0.06, 0.5),
  ...ripple(beat(5), ["C4", "E4", "G4", "C5"], 0.06, 0.5),

  // The ship is not going to make it to the cadence: the orchestra holds its breath.
  { v: "swell", at: beat(5.5), len: TURN - beat(5.5), vol: 1 },
  ...Array.from({ length: 10 }, (_, i): Note => ({ v: "timp", at: beat(7) + i * 0.045, len: 0.4, n: "D2", vol: 0.2 + i * 0.05 })),
];

const SCREAM: Note[] = [
  // Trombones low, trumpets on top: G minor with a flattened fifth and a flat ninth.
  ...chord("brass", TURN, 1.6, ["G2", "Db3", "G3", "Bb3", "Db4", "Ab4"]),
  ...chord("strings", TURN, 0.5, ["G1", "G2", "Ab5"], 0.9),
  { v: "timp", at: TURN, len: 2.5, n: "G1", vol: 1 },
  { v: "tamtam", at: TURN + 0.02, len: END - TURN },
];

// The same tune in G minor on the celesta, sliding down a semitone onto G,
// with the tritone left hanging at the very end.
const M = 0.5;
const NIGHT: Note[] = [
  ...["G1", "D2"].map((n): Note => ({ v: "lowtrem", at: TURN + 0.3, len: END - TURN - 0.3, n })),
  { v: "lowtrem", at: 5.6, len: END - 5.6, n: "Ab2", vol: 0.45 },
  { v: "hightrem", at: TURN + 0.6, len: 2.3, n: "D6", vol: 0.8 },
  { v: "hightrem", at: TURN + 2.8, len: 2.3, n: "Eb6", vol: 0.6 },
  ...line("celesta", 4.7, M, [["D4", 1], ["G4", 1], ["Bb4", 2], ["A4", 1], ["Ab4", 1], ["G4", 3]], 1.2),
  ...line("celesta", 4.7, M, [["D3", 1], ["G3", 1], ["Bb3", 2], ["A3", 1], ["Ab3", 1], ["G3", 3]], 0.6),
  ...chord("horn", 6.7, 2.1, ["G2", "D3", "Bb3"], 0.35), // muted, a long way off
  { v: "timp", at: 7.2, len: 1.8, n: "G1", vol: 0.35 },
  { v: "celesta", at: 8.1, len: 1, n: "Db5", vol: 0.5 },
];

const SCORE: Note[] = [...MAIN_TITLE, ...SCREAM, ...NIGHT];

// ── The instruments ──────────────────────────────────────────────────────

function osc(ctx: BaseAudioContext, type: OscillatorType, f: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  return o;
}

/** A gain that rises over `attack` to `peak`, holds, and falls away by `end`. */
function envelope(ctx: BaseAudioContext, t: number, attack: number, peak: number, end: number, release = 0.08): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, Math.max(t + attack, end - release));
  g.gain.linearRampToValueAtTime(0, end);
  return g;
}

function lowpass(ctx: BaseAudioContext, f: number, q = 0.7): BiquadFilterNode {
  const lp = ctx.createBiquadFilter();
  lp.frequency.value = f;
  lp.Q.value = q;
  return lp;
}

function noise(ctx: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

/** A generated concert hall: decaying noise, a little longer on the right. */
function hall(ctx: BaseAudioContext, seconds: number): ConvolverNode {
  const len = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** (c ? 2.6 : 3);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

/** A vibrato for `targets`: a sine wobbling their pitch by `cents`. */
function vibrato(ctx: BaseAudioContext, rate: number, cents: number, targets: OscillatorNode[]): OscillatorNode {
  const lfo = osc(ctx, "sine", rate);
  const depth = ctx.createGain();
  depth.gain.value = cents;
  lfo.connect(depth);
  for (const o of targets) depth.connect(o.detune);
  return lfo;
}

/**
 * A section of players on one note: sawtooths spread a few cents apart, so
 * they beat against each other like a dozen bows rather than one.
 */
function section(ctx: BaseAudioContext, f: number, players: number, spread: number, into: AudioNode): OscillatorNode[] {
  const each = ctx.createGain();
  each.gain.value = 1 / Math.sqrt(players);
  each.connect(into);
  return Array.from({ length: players }, (_, i) => {
    const o = osc(ctx, "sawtooth", f, (i / (players - 1) - 0.5) * 2 * spread);
    o.connect(each);
    return o;
  });
}

/** Plays `note` at context time `t`, from score time `from` (later than note.at when joining part-way). */
function play(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, note: Note, t: number, from: number, len: number): void {
  const f = note.n ? hz(note.n) : 0;
  const vol = note.vol ?? 1;
  const end = t + len;
  const route = (node: AudioNode, wetness: number) => {
    const pan = ctx.createStereoPanner();
    pan.pan.value = note.pan ?? SEATS[note.v];
    node.connect(pan);
    pan.connect(dry);
    const send = ctx.createGain();
    send.gain.value = wetness;
    pan.connect(send).connect(wet);
  };
  const run = (nodes: AudioScheduledSourceNode[], stop = end + 0.1) =>
    nodes.forEach((n) => {
      n.start(t);
      n.stop(stop);
    });

  switch (note.v) {
    case "horn": {
      // Four horns in unison: a dark, round tone whose brightness blooms as the note speaks.
      const legato = end + 0.06;
      const g = envelope(ctx, t, 0.06, 0.12 * vol, legato, 0.1);
      const lp = lowpass(ctx, 500, 1.2);
      lp.frequency.setValueAtTime(450, t);
      lp.frequency.linearRampToValueAtTime(1700, t + 0.09);
      lp.frequency.linearRampToValueAtTime(1200, t + 0.3);
      const reeds = section(ctx, f, 4, 5, lp);
      const body = osc(ctx, "triangle", f);
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.6;
      body.connect(bodyGain).connect(lp);
      lp.connect(g);
      route(g, 0.45);
      run([...reeds, body, vibrato(ctx, 4.8, 5, [...reeds, body])], legato + 0.1);
      break;
    }
    case "violins": {
      // First violins on the tune: a big section, quick to speak, joined note to note.
      const legato = end + 0.08;
      const g = envelope(ctx, t, 0.05, 0.08 * vol, legato, 0.12);
      const lp = lowpass(ctx, 4200);
      const bows = section(ctx, f, 6, 11, lp);
      lp.connect(g);
      route(g, 0.55);
      run([...bows, vibrato(ctx, 5.6, 9, bows)], legato + 0.1);
      break;
    }
    case "strings": {
      // Violas, cellos and basses on the chords; the low notes darker than the high.
      const g = envelope(ctx, t, 0.14, 0.048 * vol, end + 0.25, 0.35);
      const lp = lowpass(ctx, Math.min(3200, f * 9));
      const bows = section(ctx, f, 5, 10, lp);
      lp.connect(g);
      route(g, 0.5);
      run([...bows, vibrato(ctx, 5.2, 7, bows)], end + 0.35);
      break;
    }
    case "lowtrem":
    case "hightrem": {
      // Bowed tremolo: the section's loudness shaken a dozen times a second.
      const high = note.v === "hightrem";
      const g = envelope(ctx, t, high ? 0.9 : 1.2, (high ? 0.018 : 0.06) * vol, end, high ? 1 : 3.5);
      const shake = ctx.createGain();
      shake.gain.value = 0.6;
      const lfo = osc(ctx, "sine", high ? 13 : 11);
      const depth = ctx.createGain();
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(shake.gain);
      const lp = lowpass(ctx, high ? 5000 : 420);
      const bows = section(ctx, f, high ? 5 : 4, high ? 8 : 6, lp);
      lp.connect(shake).connect(g);
      route(g, high ? 0.8 : 0.5);
      run([...bows, lfo]);
      break;
    }
    case "brass": {
      // A fortissimo chord: the bell flares open, then settles to a snarl and fades.
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06 * vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.025 * vol, t + 0.5);
      g.gain.linearRampToValueAtTime(0, end);
      const lp = lowpass(ctx, 800, 1.5);
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 14), t + 0.05);
      lp.frequency.exponentialRampToValueAtTime(Math.min(2200, f * 6), t + 0.7);
      const bells = section(ctx, f, 3, 6, lp);
      lp.connect(g);
      route(g, 0.55);
      run(bells);
      break;
    }
    case "harp": {
      // A plucked string: a bright, quick attack and a ring that dulls as it fades.
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07 * vol, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, end);
      const lp = lowpass(ctx, 3000);
      lp.frequency.setValueAtTime(Math.min(6000, f * 8), t);
      lp.frequency.exponentialRampToValueAtTime(Math.min(1500, f * 3), t + 0.5);
      const string = osc(ctx, "triangle", f);
      const octave = osc(ctx, "sine", f * 2);
      const octaveGain = ctx.createGain();
      octaveGain.gain.value = 0.3;
      string.connect(lp);
      octave.connect(octaveGain).connect(lp);
      lp.connect(g);
      route(g, 0.6);
      run([string, octave]);
      break;
    }
    case "celesta": {
      // Hammered steel bars over wooden resonators: a pure tone and a glint above it.
      // The low bars ring on for longer.
      const ring = Math.min(1.8, Math.max(1, 520 / f));
      [
        [1, 0.1, 2.2],
        [2, 0.025, 1],
        [4, 0.02, 0.35],
        [9.2, 0.008, 0.12],
      ].forEach(([ratio, level, decay]) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level * vol, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0003, t + decay * ring);
        const o = osc(ctx, "sine", f * ratio);
        o.connect(g);
        route(g, 0.7);
        o.start(t);
        o.stop(t + decay * ring + 0.05);
      });
      break;
    }
    case "timp": {
      // A timpani stroke: a falling thud and a burst of felt.
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.45 * vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, end);
      const o = osc(ctx, "sine", f * 2);
      o.frequency.setValueAtTime(f * 2.2, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.3);
      const overtone = osc(ctx, "sine", f * 3.0);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.25, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g);
      overtone.connect(og).connect(g);
      const hit = noise(ctx, 0.3);
      const felt = lowpass(ctx, 450);
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.3, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      hit.connect(felt).connect(hg).connect(g);
      route(g, 0.45);
      run([o, overtone, hit]);
      break;
    }
    case "swell": {
      // A suspended cymbal rolled from nothing, cut off as the next thing lands.
      const src = noise(ctx, 2);
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 4000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05 * vol, end);
      g.gain.linearRampToValueAtTime(0, end + 0.08);
      src.connect(hp).connect(g);
      route(g, 0.6);
      run([src], end + 0.1);
      break;
    }
    case "tamtam": {
      // A tam-tam struck hard: a low shimmer that blooms after the hit and takes ages to die.
      const src = noise(ctx, 2);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.exponentialRampToValueAtTime(350, t + 3);
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09 * vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.15);
      g.gain.linearRampToValueAtTime(0.07 * vol, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0005, end);
      const hum = osc(ctx, "sine", 72);
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.08 * vol, t);
      hg.gain.exponentialRampToValueAtTime(0.0005, t + 3);
      src.connect(bp).connect(g);
      hum.connect(hg).connect(g);
      route(g, 0.7);
      run([src, hum]);
      break;
    }
  }
}

// ── Playback ──────────────────────────────────────────────────────────────

/**
 * Schedules the score on `c` from score time `elapsed`, starting at context
 * time `now`, and returns its master gain. Works offline too, for rendering.
 */
export function perform(c: BaseAudioContext, now: number, elapsed = 0): GainNode {
  const master = c.createGain();
  master.gain.value = 0.8;
  master.connect(c.createDynamicsCompressor()).connect(c.destination);
  const wet = c.createGain(); // every voice's reverb send
  const back = c.createGain();
  back.gain.value = 0.45;
  wet.connect(hall(c, 3.6)).connect(back).connect(master);
  // Notes already over are skipped; long ones under way join part-way.
  for (const note of SCORE) {
    const from = Math.max(note.at, elapsed);
    const len = note.at + note.len - from;
    if (len < 0.15 || (from > note.at && !SUSTAINED.includes(note.v))) continue;
    play(c, master, wet, note, now + from - elapsed, from, len);
  }
  return master;
}

/** How long the score runs, reverb tail included. */
export const THEME_LENGTH = END + TAIL;

export interface Theme {
  /** Whether the browser is letting it be heard. */
  readonly playing: boolean;
  /** Starts (or restarts) the sound from wherever the intro has got to. Call from a click. */
  unmute(): void;
  mute(): void;
  /** Fades out over `fade` seconds, for a skip. */
  stop(fade: number): void;
  /** Lets the score play to its end, for an intro that ran its course. */
  finish(): void;
}

/**
 * Starts the theme now if the browser allows it and the player hasn't turned
 * sound off. `onChange` hears when it starts or stops being audible.
 */
export function playTheme(onChange: (playing: boolean) => void): Theme | null {
  const Ctx = audioContext();
  if (!Ctx) return null;
  const begun = performance.now();
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let playing = false;
  let stopped = false;

  const start = () => {
    if (stopped || playing) return;
    ctx ??= new Ctx();
    const at = (performance.now() - begun) / 1000;
    if (at >= END) return;
    const c = ctx;
    const go = () => {
      if (stopped || playing || c.state !== "running") return;
      const now = c.currentTime + 0.05;
      const elapsed = (performance.now() - begun) / 1000;
      master = perform(c, now, elapsed);
      playing = true;
      onChange(true);
      const ending = c;
      setTimeout(() => ctx === ending && silence(0.1), (END + TAIL - elapsed) * 1000);
    };
    if (c.state === "running") go();
    else c.resume().then(go, () => {});
  };

  const silence = (fade: number) => {
    if (!ctx) return;
    const c = ctx;
    if (master) {
      const g = master.gain;
      g.cancelScheduledValues(c.currentTime);
      g.setValueAtTime(g.value, c.currentTime);
      g.linearRampToValueAtTime(0, c.currentTime + fade);
    }
    setTimeout(() => void c.close().catch(() => {}), fade * 1000 + 100);
    ctx = null;
    master = null;
    if (playing) {
      playing = false;
      onChange(false);
    }
  };

  if (soundWanted()) start();
  return {
    get playing() {
      return playing;
    },
    unmute() {
      rememberSound(true);
      start();
    },
    mute() {
      rememberSound(false);
      silence(0.3);
    },
    stop(fade) {
      silence(fade);
      stopped = true;
    },
    finish() {
      stopped = true;
      if (!playing) silence(0);
    },
  };
}
