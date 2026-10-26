/**
 * All sound is synthesised with the Web Audio API: no audio files, in keeping with the rest of the game.
 * Effects are short oscillator/noise envelopes; the music is a slow, generated pentatonic pluck loop;
 * birds sing by day and crickets by night.
 */

export type Sfx =
  | 'plow'
  | 'plant'
  | 'water'
  | 'care'
  | 'fertilize'
  | 'harvest'
  | 'clear'
  | 'buy'
  | 'sell'
  | 'error'
  | 'levelup'
  | 'expand'
  | 'click'
  | 'select'
  | 'feed'
  | 'collect'
  | 'build'
  | 'galinha'
  | 'vaca'
  | 'porco'
  | 'sprinkle'
  | 'meow'
  | 'truck'
  | 'delivery';

const STORAGE_KEY = 'lucky-harvest:muted';

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  attack?: number;
  dest?: AudioNode;
  filter?: number;
}

interface NoiseOptions {
  type?: BiquadFilterType;
  from: number;
  to?: number;
  gain?: number;
  attack?: number;
  q?: number;
}

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

// Chord roots (MIDI) for the generated progressions: bright by day, softer by night.
const DAY_PROGRESSION = [60, 57, 53, 55]; // C Am F G
const NIGHT_PROGRESSION = [57, 53, 60, 55]; // Am F C G
const MAJOR_TRIAD = [0, 4, 7];
const MINOR_TRIAD = [0, 3, 7];
const PENTATONIC = [0, 2, 4, 7, 9];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private nextBeat = 0;
  private beat = 0;
  private night = 0;
  private nextBird = 0;
  private nextCricket = 0;
  private muted: boolean;
  private volume = 1;

  constructor() {
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* private mode: start unmuted */
    }
    this.muted = stored;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (!this.muted) void this.ctx.resume();
    });
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Browsers only allow audio after a user gesture: call this from the first tap or click. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.noiseBuffer = this.makeNoise();
      this.nextBeat = this.ctx.currentTime + 0.4;
      this.nextBird = this.ctx.currentTime + 3;
      this.nextCricket = this.ctx.currentTime + 1;
      window.setInterval(() => this.schedule(), 200);
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Night changes the mood: crickets instead of birds, a softer progression. */
  setNight(night: number): void {
    this.night = night;
  }

  play(sfx: Sfx, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    this.volume = volume;
    const t = ctx.currentTime;
    switch (sfx) {
      case 'plow':
        this.noise(t, 0.24, { type: 'lowpass', from: 1100, to: 260, gain: 0.5, attack: 0.01 });
        this.tone(t, 0.16, 120, { type: 'sine', slideTo: 55, gain: 0.35 });
        break;
      case 'plant':
        this.tone(t, 0.12, 330, { type: 'sine', slideTo: 700, gain: 0.3 });
        this.tone(t + 0.07, 0.1, 990, { type: 'sine', gain: 0.1 });
        break;
      case 'water':
        this.noise(t, 0.45, { type: 'bandpass', from: 2200, to: 4200, gain: 0.22, attack: 0.12, q: 0.7 });
        for (let n = 0; n < 3; n++) this.tone(t + 0.08 + n * 0.1, 0.09, 520 + n * 170, { type: 'sine', slideTo: 900 + n * 150, gain: 0.12 });
        break;
      case 'care':
        [660, 880, 1175].forEach((f, n) => this.tone(t + n * 0.065, 0.14, f, { type: 'triangle', gain: 0.2 }));
        break;
      case 'fertilize':
        // A soft pour of grain, then a small rising chime for the growth spurt.
        this.noise(t, 0.3, { type: 'bandpass', from: 900, to: 1800, gain: 0.2, attack: 0.04, q: 0.8 });
        [523, 659, 784].forEach((f, n) => this.tone(t + 0.18 + n * 0.07, 0.16, f, { type: 'sine', gain: 0.16 }));
        break;
      case 'harvest':
        this.tone(t, 0.3, 988, { type: 'triangle', gain: 0.32 });
        this.tone(t + 0.08, 0.45, 1319, { type: 'triangle', gain: 0.32 });
        this.tone(t + 0.1, 0.3, 2637, { type: 'sine', gain: 0.07 });
        break;
      case 'clear':
        this.noise(t, 0.16, { type: 'highpass', from: 1500, gain: 0.3, attack: 0.005 });
        break;
      case 'buy':
        this.tone(t, 0.14, 523, { type: 'triangle', gain: 0.28 });
        this.tone(t + 0.09, 0.28, 784, { type: 'triangle', gain: 0.28 });
        break;
      case 'sell':
        [1047, 1319, 1568, 2093].forEach((f, n) => this.tone(t + n * 0.07, 0.3, f, { type: 'triangle', gain: 0.26 }));
        break;
      case 'error':
        this.tone(t, 0.2, 190, { type: 'square', slideTo: 130, gain: 0.12, filter: 900 });
        break;
      case 'levelup':
        [72, 76, 79, 84].forEach((n, k) => this.tone(t + k * 0.11, 0.35, midi(n), { type: 'triangle', gain: 0.3 }));
        [72, 76, 79, 84].forEach((n) => this.tone(t + 0.5, 1.1, midi(n), { type: 'sine', gain: 0.12, attack: 0.03 }));
        break;
      case 'expand':
        [60, 64, 67, 72, 76, 79].forEach((n, k) => this.tone(t + k * 0.08, 0.4, midi(n), { type: 'triangle', gain: 0.25 }));
        this.noise(t, 0.6, { type: 'bandpass', from: 400, to: 3000, gain: 0.18, attack: 0.3, q: 0.8 });
        break;
      case 'click':
        this.tone(t, 0.05, 760, { type: 'sine', gain: 0.12 });
        break;
      case 'select':
        this.tone(t, 0.06, 520, { type: 'sine', slideTo: 600, gain: 0.14 });
        break;
      case 'feed':
        this.noise(t, 0.28, { type: 'bandpass', from: 1800, to: 900, gain: 0.3, attack: 0.02, q: 0.9 });
        this.tone(t + 0.05, 0.1, 300, { type: 'sine', slideTo: 220, gain: 0.18 });
        break;
      case 'collect':
        [784, 1047, 1319].forEach((f, n) => this.tone(t + n * 0.06, 0.22, f, { type: 'triangle', gain: 0.26 }));
        break;
      case 'build':
        this.noise(t, 0.08, { type: 'lowpass', from: 900, gain: 0.5, attack: 0.002 });
        this.noise(t + 0.18, 0.08, { type: 'lowpass', from: 900, gain: 0.5, attack: 0.002 });
        [60, 67, 72].forEach((n, k) => this.tone(t + 0.34 + k * 0.08, 0.35, midi(n), { type: 'triangle', gain: 0.24 }));
        break;
      case 'galinha':
        [0, 0.09, 0.2].forEach((d, n) => this.tone(t + d, 0.08, 900 + n * 120, { type: 'square', slideTo: 1300 + n * 100, gain: 0.07, filter: 2200 }));
        break;
      case 'vaca':
        this.tone(t, 0.7, 150, { type: 'sawtooth', slideTo: 105, gain: 0.16, attack: 0.08, filter: 600 });
        break;
      case 'sprinkle':
        this.noise(t, 1.4, { type: 'bandpass', from: 3500, to: 5200, gain: 0.16, attack: 0.25, q: 0.6 });
        for (let n = 0; n < 4; n++) this.tone(t + 0.1 + n * 0.22, 0.08, 1500 + n * 120, { type: 'sine', slideTo: 2400, gain: 0.05 });
        break;
      case 'truck':
        // Two friendly beeps from an old horn, over a low engine grumble.
        this.tone(t, 0.16, 392, { type: 'square', gain: 0.07, filter: 1200 });
        this.tone(t + 0.22, 0.26, 392, { type: 'square', gain: 0.07, filter: 1200 });
        this.tone(t, 0.16, 494, { type: 'square', gain: 0.05, filter: 1200 });
        this.tone(t + 0.22, 0.26, 494, { type: 'square', gain: 0.05, filter: 1200 });
        this.tone(t, 1.1, 62, { type: 'sawtooth', slideTo: 48, gain: 0.07, filter: 220, attack: 0.1 });
        break;
      case 'delivery':
        // Sacks thumping into the loft, then a bright arpeggio.
        for (let n = 0; n < 4; n++) this.tone(t + n * 0.14, 0.12, 150 - n * 14, { type: 'triangle', gain: 0.16, slideTo: 90 });
        for (let n = 0; n < 4; n++) this.tone(t + 0.6 + n * 0.09, 0.25, midi(72 + [0, 4, 7, 12][n]!), { type: 'sine', gain: 0.1 });
        break;
      case 'meow':
        this.tone(t, 0.32, 620, { type: 'triangle', slideTo: 900, gain: 0.14, attack: 0.05 });
        this.tone(t + 0.3, 0.3, 900, { type: 'triangle', slideTo: 520, gain: 0.12 });
        break;
      case 'porco':
        this.tone(t, 0.12, 260, { type: 'sawtooth', slideTo: 170, gain: 0.14, filter: 700 });
        this.tone(t + 0.15, 0.14, 240, { type: 'sawtooth', slideTo: 150, gain: 0.14, filter: 700 });
        break;
    }
    this.volume = 1;
  }

  // ---- Synthesis helpers -------------------------------------------------

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private tone(start: number, dur: number, freq: number, o: ToneOptions = {}): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, start + dur);

    const gain = ctx.createGain();
    const peak = (o.gain ?? 0.2) * this.volume;
    const attack = o.attack ?? 0.008;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    let tail: AudioNode = osc;
    if (o.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.filter;
      osc.connect(lp);
      tail = lp;
    }
    tail.connect(gain);
    gain.connect(o.dest ?? this.sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, o: NoiseOptions): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type ?? 'lowpass';
    filter.Q.value = o.q ?? 1;
    filter.frequency.setValueAtTime(o.from, start);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, start + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime((o.gain ?? 0.3) * this.volume, start + (o.attack ?? 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(start, Math.random());
    src.stop(start + dur + 0.05);
  }

  // ---- Music and ambience ------------------------------------------------

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || document.hidden) return;
    const horizon = ctx.currentTime + 0.6;
    const beatLength = this.night > 0.5 ? 0.95 : 0.8;

    while (this.nextBeat < horizon) {
      this.playBeat(this.nextBeat);
      this.nextBeat += beatLength;
      this.beat++;
    }
    if (this.night < 0.4) {
      while (this.nextBird < horizon) {
        this.chirp(this.nextBird);
        this.nextBird += 2.5 + Math.random() * 6;
      }
    } else if (this.night > 0.6) {
      while (this.nextCricket < horizon) {
        this.cricket(this.nextCricket);
        this.nextCricket += 0.7 + Math.random() * 0.8;
      }
    } else {
      this.nextBird = Math.max(this.nextBird, ctx.currentTime + 2);
      this.nextCricket = Math.max(this.nextCricket, ctx.currentTime + 1);
    }
  }

  private playBeat(t: number): void {
    const night = this.night > 0.5;
    const bar = Math.floor(this.beat / 4);
    const step = this.beat % 4;
    const progression = night ? NIGHT_PROGRESSION : DAY_PROGRESSION;
    const root = progression[bar % progression.length]!;
    const triad = root === 57 || root === 62 ? MINOR_TRIAD : MAJOR_TRIAD;
    const dest = this.musicBus;

    if (step === 0) {
      // A soft pad under the whole bar.
      for (const interval of triad) {
        this.tone(t, 3.4, midi(root - 12 + interval), { type: 'sine', gain: night ? 0.06 : 0.05, attack: 0.5, dest });
      }
    }
    // Plucked melody from the pentatonic scale, sparse and unhurried.
    const chance = night ? 0.5 : 0.7;
    if (Math.random() < chance) {
      const note = root + 12 + PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)]!;
      this.tone(t, 0.9, midi(note), { type: 'triangle', gain: night ? 0.07 : 0.09, filter: 2400, dest });
    }
    if (step === 2 && Math.random() < 0.5) {
      this.tone(t, 0.8, midi(root + 24 + triad[Math.floor(Math.random() * 3)]!), { type: 'sine', gain: 0.04, dest });
    }
  }

  private chirp(t: number): void {
    const base = 2300 + Math.random() * 1400;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let n = 0; n < notes; n++) {
      this.tone(t + n * 0.11, 0.09, base + n * 120, { type: 'sine', slideTo: base * (n % 2 ? 0.8 : 1.25), gain: 0.04, dest: this.musicBus });
    }
  }

  private cricket(t: number): void {
    for (let n = 0; n < 4; n++) {
      this.tone(t + n * 0.055, 0.035, 4300, { type: 'sine', gain: 0.022, attack: 0.004, dest: this.musicBus });
    }
  }
}
