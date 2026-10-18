// Small seeded PRNG (mulberry32) so every case is reproducible from its seed.

export interface Rng {
  next(): number;
  int(n: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => Math.floor(next() * n);
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error("pick from empty list");
      return items[int(items.length)];
    },
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** Derive a new seed from a base seed and a counter (used for retry attempts). */
export function mixSeed(a: number, b: number): number {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ b;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Seed for the daily case, e.g. dailySeed(new Date()). */
export function dailySeed(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return mixSeed(y * 10000 + m * 100 + d, 0x1927);
}
