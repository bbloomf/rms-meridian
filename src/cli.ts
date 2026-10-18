// Usage:
//   node src/cli.ts [seed] [--spoil]   print one case (random seed if omitted)
//   add --dialogue to show testimony as spoken lines (characters with templates only)
//   node src/cli.ts --daily [--spoil]  today's daily case
//   node src/cli.ts --stats [N]        generate N cases and summarise them

import { CAST, ROOMS, SLOTS, WEAPONS, inRoom } from "./data.ts";
import type { CharId } from "./data.ts";
import type { Case } from "./generate.ts";
import { AP_BUDGET, generateCase } from "./solver.ts";
import type { Action, Contradiction, Report } from "./solver.ts";
import { dailySeed } from "./rng.ts";
import { voiceFor } from "./dialogue/render.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const positional = args.filter((a) => !a.startsWith("--"));

if (flag("--stats")) {
  stats(Number(positional[0] ?? 500));
} else {
  const seed = flag("--daily")
    ? dailySeed(new Date())
    : positional[0] !== undefined
      ? Number(positional[0])
      : Math.floor(Math.random() * 1_000_000);
  const { case: c, report, attempts } = generateCase(seed);
  printCase(c, report, attempts, flag("--spoil"), flag("--dialogue"));
}

function name(id: CharId): string {
  return CAST[id].name;
}

function printCase(c: Case, r: Report, attempts: number, spoil: boolean, dialogue: boolean): void {
  const v = CAST[c.victim];
  const win = `${SLOTS[c.window[0]].label} and ${SLOTS[c.window[c.window.length - 1]].label}`;
  heading(`THE RMS MERIDIAN · Case ${c.seed}`);
  console.log(`At eleven o'clock, ${v.name} (${v.role}) is found dead on the Boat Deck.`);
  console.log(`The ship's doctor puts the time of death between ${win}.`);
  console.log(`The Captain radios New York at midnight. You have ${AP_BUDGET} actions.\n`);

  console.log("Suspects:");
  for (const s of c.suspects) console.log(`  ${CAST[s].name}, ${CAST[s].role}`);
  console.log("\nRooms in play:");
  for (const room of c.rooms) console.log(`  ${ROOMS[room].name}${ROOMS[room].crewOnly ? " (crew only)" : ""}`);
  console.log("\nWeapons in play, and where each is kept:");
  for (const w of c.weapons) console.log(`  ${WEAPONS[w].name.padEnd(18)} ${ROOMS[c.weaponHome[w]].name}`);

  heading("Testimony");
  for (const s of c.suspects) {
    const voice = dialogue ? voiceFor(c, s) : null;
    console.log(name(s));
    if (voice) console.log(`  "${voice.greeting()}"`);
    for (const st of c.testimony[s]) {
      const seen = st.sightings.length ? `saw ${st.sightings.map(name).join(", ")}` : "saw no one";
      const lie = spoil && st.lie ? `   <- LIE (really ${inRoom(c.schedule[s][st.slot]!)})` : "";
      console.log(`  ${SLOTS[st.slot].label}  ${ROOMS[st.claim].name.padEnd(16)} ${seen}${lie}`);
      if (voice) console.log(`         "${voice.testimony(st.slot)}"`);
    }
  }
  if (dialogue) printDialogueExtras(c, spoil);

  heading("Search results");
  for (const room of c.rooms) {
    const res = c.searches[room];
    const notes = [
      ...res.present.map((w) => `the ${WEAPONS[w].name} is where it belongs`),
      ...(res.missing ? [`the ${WEAPONS[res.missing].name} is missing from its place`] : []),
      ...(res.found ? [`a ${WEAPONS[res.found].name}, wiped but stained, is hidden here`] : []),
      ...(res.struggle ? ["signs of a struggle"] : []),
    ];
    console.log(`  ${ROOMS[room].name.padEnd(16)} ${notes.length ? notes.join("; ") : "nothing of note"}`);
  }

  heading("Solver");
  console.log(`  Fair: ${r.unique ? "yes, exactly one solution survives all the evidence" : "NO"}`);
  console.log(`  Searches: ${r.minSearches} with hindsight, ${r.avgSearches.toFixed(1)} on average in random order`);
  console.log(`  Questions: ${r.minAsks} with hindsight`);
  console.log(`  Estimated actions: ${r.estimate.toFixed(1)} of ${AP_BUDGET}`);
  console.log(`  Contradictions available: ${r.contradictions.length}`);
  console.log(`  Generator attempts: ${attempts}`);

  if (!spoil) {
    console.log("\n(Run again with --spoil for the solution, lies and contradictions.)");
    return;
  }

  heading("Contradictions");
  for (const x of r.contradictions) console.log(`  ${describe(x)}`);
  console.log(`\n  Shortest route: search ${r.searchSet.map((room) => ROOMS[room].name).join(", ")};`);
  console.log(`  ask ${r.askSet.map(askLabel).join(", ")}.`);
  console.log(
    r.killerLieExposed
      ? "  The killer's own alibi can be caught in a contradiction."
      : "  The killer's alibi can't be caught directly; only elimination finds them.",
  );

  heading("Solution");
  const { killer, weapon, room, slot, hiddenIn, alibi } = c.solution;
  const k = CAST[killer];
  console.log(`  ${k.name}, with the ${WEAPONS[weapon].name}, ${inRoom(room)}, at ${SLOTS[slot].label}.`);
  console.log(`  ${capitalise(k.pronouns.subject)} hid the ${WEAPONS[weapon].name} ${inRoom(hiddenIn)} and claimed to be ${inRoom(alibi)}.`);
  for (const sec of c.secrets) {
    const s = CAST[sec.who];
    const confession = s.secrets.find((x) => x.id === sec.secretId)!.confession;
    console.log(`  Red herring: ${s.name} lied about ${s.pronouns.possessive} whereabouts at ${SLOTS[sec.slot].label}: "${confession}"`);
  }
}

function printDialogueExtras(c: Case, spoil: boolean): void {
  for (const s of c.suspects) {
    const voice = voiceFor(c, s);
    if (!voice) continue;
    heading(`More from ${name(s)}`);
    for (const other of [c.victim, ...c.suspects.filter((o) => o !== s)]) {
      console.log(`  On ${name(other)}: "${voice.opinion(other)}"`);
    }
    if (!spoil) continue;
    const secret = c.secrets.find((x) => x.who === s);
    const killer = c.solution.killer === s;
    const witness = c.suspects.find((o) => o !== s)!;
    if (secret || killer) {
      const line = voice.confront(witness, !killer);
      const confession = secret ? ` ${CAST[s].secrets.find((x) => x.id === secret.secretId)!.confession}` : "";
      console.log(`  Confronted: "${line}${confession}"`);
    }
    console.log(`  Accused: "${voice.accused(killer, c.solution.weapon, c.solution.room)}"`);
  }
}

function describe(x: Contradiction): string {
  const p = CAST[x.who];
  const says = `${p.name} says ${p.pronouns.subject} was ${inRoom(x.claim)} at ${SLOTS[x.slot].label}`;
  return x.kind === "seenElsewhere"
    ? `${says}, but ${name(x.witness)} saw ${p.pronouns.object} ${inRoom(x.actual)}.`
    : `${says}, but ${name(x.witness)} was there and didn't see ${p.pronouns.object}.`;
}

function askLabel(a: Action): string {
  return a.kind === "ask" ? `${CAST[a.who].short} about ${SLOTS[a.slot].label}` : ROOMS[a.room].name;
}

function stats(n: number): void {
  const started = performance.now();
  let attempts = 0;
  let exposed = 0;
  const asks = new Map<number, number>();
  const estimates: number[] = [];
  const killers = new Map<CharId, number>();
  const victims = new Map<CharId, number>();
  const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

  for (let seed = 1; seed <= n; seed++) {
    const g = generateCase(seed);
    attempts += g.attempts;
    if (g.report.killerLieExposed) exposed++;
    bump(asks, g.report.minAsks!);
    estimates.push(g.report.estimate);
    bump(killers, g.case.solution.killer);
    bump(victims, g.case.victim);
  }

  const ms = performance.now() - started;
  const pct = (x: number) => `${((100 * x) / n).toFixed(0)}%`;
  heading(`${n} cases`);
  console.log(`  Time: ${(ms / n).toFixed(1)} ms per accepted case`);
  console.log(`  Acceptance: ${((100 * n) / attempts).toFixed(1)}% of candidates (${(attempts / n).toFixed(1)} attempts per case)`);
  console.log(`  Estimated actions: mean ${mean(estimates).toFixed(1)}, max ${Math.max(...estimates).toFixed(1)} of ${AP_BUDGET}`);
  console.log(`  Killer's lie directly catchable: ${pct(exposed)}`);
  console.log(`  Minimum questions: ${[...asks].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}: ${pct(v)}`).join("  ")}`);
  console.log(`  Killer:  ${[...killers].map(([k, v]) => `${CAST[k].short} ${pct(v)}`).join("  ")}`);
  console.log(`  Victim:  ${[...victims].map(([k, v]) => `${CAST[k].short} ${pct(v)}`).join("  ")}`);
}

function heading(text: string): void {
  console.log(`\n── ${text} ${"─".repeat(Math.max(0, 60 - text.length))}`);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function capitalise(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
