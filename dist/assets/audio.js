// @ts-check
export class Sound {
  constructor() {
    /** @type {AudioContext|null} */
    this.context = null;
    this.enabled = false;
  }
  unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }
  /** @param {string} event */
  play(event) {
    if (!this.enabled || !this.context) return;
    const c = this.context;
    const notes = {
      peanut: [660],
      power: [440, 660, 880],
      snake: [880, 1100],
      hit: [220, 160],
      levelComplete: [523, 659, 784, 1046],
      won: [523, 659, 784, 1046, 1318],
      start: [440, 660],
    };
    const tones = notes[/** @type {keyof typeof notes} */ (event)];
    if (!tones) return;
    tones.forEach((frequency, i) => {
      const o = c.createOscillator(),
        g = c.createGain(),
        start = c.currentTime + i * 0.09;
      o.type = "sine";
      o.frequency.value = frequency;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(
        event === "peanut" ? 0.025 : 0.06,
        start + 0.008,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      o.connect(g);
      g.connect(c.destination);
      o.start(start);
      o.stop(start + 0.11);
    });
  }
}
