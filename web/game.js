export const DURATIONS = [15, 30, 60, 120];

export function shuffled(words, random = Math.random) {
  const result = [...words];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// The rules and character accounting match the original C++ typing engine.
export class Game {
  constructor(words, mode = "speed", duration = 30, random = Math.random) {
    if (
      !words.length ||
      !["speed", "survival"].includes(mode) ||
      !DURATIONS.includes(duration)
    ) {
      throw new Error("Invalid game configuration.");
    }
    this.words = shuffled(words, random);
    this.mode = mode;
    this.duration = duration;
    this.remaining = mode === "survival" ? 15 : duration;
    this.elapsed = 0;
    this.index = 0;
    this.input = "";
    this.correct = 0;
    this.total = 0;
    this.completed = [];
    this.running = false;
    this.finished = false;
    this.lastTime = null;
  }
  get target() {
    return this.words[this.index % this.words.length];
  }
  matches(input) {
    return [...input].filter((char, index) => char === this.target[index])
      .length;
  }
  get correctCharacters() {
    return this.correct + this.matches(this.input);
  }
  get totalCharacters() {
    return this.total + this.input.length;
  }
  get wpm() {
    return this.elapsed > 0 ? (this.correctCharacters * 12) / this.elapsed : 0;
  }
  get accuracy() {
    return this.totalCharacters
      ? (100 * this.correctCharacters) / this.totalCharacters
      : 100;
  }
  advance(now) {
    if (!this.running || this.finished) return;
    const delta = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const used = Math.min(this.remaining, delta);
    this.remaining = Math.max(0, this.remaining - used);
    this.elapsed += used;
    if (this.remaining <= 0) {
      this.finished = true;
      this.running = false;
    }
  }
  type(text, now) {
    // Process elapsed time before input: late keys cannot rescue an expired round.
    this.advance(now);
    if (this.finished) return [];
    if (!this.running && text.trim()) {
      this.running = true;
      this.lastTime = now;
    }
    const submitted = [];
    const pieces = text.replace(/[\r\n]/g, " ").split(" ");
    this.input = pieces.pop();
    for (const word of pieces) {
      if (!word) continue;
      const expected = this.target;
      const correct = word === expected;
      this.correct += this.matches(word) + (correct ? 1 : 0);
      this.total += word.length + 1;
      this.completed.push({ word: expected, correct });
      this.completed = this.completed.slice(-3);
      this.index++;
      submitted.push(correct);
      if (this.mode === "survival") {
        this.remaining = Math.min(
          30,
          Math.max(0, this.remaining + (correct ? 2 : -1)),
        );
        if (!this.remaining) {
          this.finished = true;
          this.running = false;
          this.input = "";
          break;
        }
      }
    }
    return submitted;
  }
  result() {
    return {
      mode: this.mode,
      duration: this.mode === "speed" ? this.duration : 0,
      wpm: this.wpm,
      accuracy: this.accuracy,
      elapsed: this.elapsed,
    };
  }
}
