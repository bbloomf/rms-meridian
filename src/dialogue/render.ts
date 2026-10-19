// Turns case facts into spoken lines using a character's templates.

import { CAST, SLOTS, WEAPONS, inRoom, the } from "../data.ts";
import type { CharId, RoomId, WeaponId } from "../data.ts";
import type { Case } from "../generate.ts";
import { makeRng, mixSeed } from "../rng.ts";
import { BIBLES } from "./bibles.ts";
import { DIALOGUE } from "./lines.ts";
import { SLOT_PATTERN } from "./schema.ts";
import type { DialogueFile } from "./schema.ts";

export interface Context {
  speaker: CharId;
  room?: RoomId;
  slot?: number;
  weapon?: WeaponId;
  other?: CharId;
  others?: CharId[];
  victim?: CharId;
  witness?: CharId;
}

export function loadDialogue(id: CharId): DialogueFile | null {
  return DIALOGUE[id] ?? null;
}

export function address(speaker: CharId, other: CharId): string {
  return BIBLES[speaker].views[other]?.address ?? CAST[other].name;
}

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function fill(template: string, ctx: Context): string {
  return template.replace(SLOT_PATTERN, (_, raw: string) => {
    const name = raw[0].toLowerCase() + raw.slice(1);
    const value = resolve(name, ctx);
    return raw[0] === raw[0].toUpperCase() ? value[0].toUpperCase() + value.slice(1) : value;
  });
}

function resolve(name: string, ctx: Context): string {
  const need = <T>(v: T | undefined): T => {
    if (v === undefined) throw new Error(`slot {${name}} has no value in this context`);
    return v;
  };
  switch (name) {
    case "room":
      return inRoom(need(ctx.room));
    case "roomName":
      return the(need(ctx.room));
    case "time":
      return SLOTS[need(ctx.slot)].phrase;
    case "weapon":
      return `the ${WEAPONS[need(ctx.weapon)].name}`;
    case "others":
      return joinList(need(ctx.others).map((o) => address(ctx.speaker, o)));
  }
  const [base, field] = name.split(".") as ["other" | "victim" | "witness", string | undefined];
  const who = need(ctx[base]);
  if (field === undefined) return address(ctx.speaker, who);
  if (field === "full") return CAST[who].name;
  if (field === "subject" || field === "object" || field === "possessive") return CAST[who].pronouns[field];
  throw new Error(`unknown slot {${name}}`);
}

/**
 * A character's voice for one case: works through each topic's variants in a
 * seeded shuffled order, so lines don't repeat until the pool runs out.
 */
export function voiceFor(c: Case, speaker: CharId) {
  const file = loadDialogue(speaker);
  if (!file) return null;
  const used = new Map<string, number>();
  // `keep` narrows the pool for one use, and gets its own turn order.
  const say = (key: string, ctx: Omit<Context, "speaker">, keep?: (line: string) => boolean): string => {
    const all = file.lines[key];
    const pool = keep ? all?.filter(keep) : all;
    if (!pool?.length) throw new Error(`${speaker} has no lines for ${key}`);
    const turn = keep ? `${key}:narrowed` : key;
    const order = makeRng(mixSeed(c.seed, hash(`${c.attempt}:${speaker}:${turn}`))).shuffle(pool);
    const n = used.get(turn) ?? 0;
    used.set(turn, n + 1);
    return fill(order[n % order.length], { ...ctx, speaker });
  };

  return {
    greeting: () => say("greeting", { victim: c.victim }),
    testimony: (slot: number): string => {
      const st = c.testimony[speaker][slot];
      const parts = [say("whereabouts", { room: st.claim, slot })];
      const rest = st.sightings.filter((p) => p !== c.victim);
      if (st.sightings.includes(c.victim)) parts.push(say("sawVictim", { victim: c.victim }));
      // After the victim, "Only Folder" would contradict the line before it.
      const alsoVictim = st.sightings.includes(c.victim) ? (line: string) => !/^(Only|Just)\b/.test(line) : undefined;
      if (rest.length === 1) parts.push(say("sawOne", { other: rest[0] }, alsoVictim));
      if (rest.length > 1) parts.push(say("sawSeveral", { others: rest }));
      if (st.sightings.length === 0) parts.push(say("sawNoOne", {}));
      return parts.join(" ");
    },
    opinion: (other: CharId) => say(other === c.victim ? `eulogy.${other}` : `opinion.${other}`, { other }),
    confront: (witness: CharId, cracks: boolean) => say(cracks ? "confrontCrack" : "confrontDeflect", { witness }),
    /** A right accusation is answered with the true weapon and room; a wrong one with the accused ones. */
    accused: (correct: boolean, weapon: WeaponId, room: RoomId) =>
      say(correct ? "accusedRightly" : "accusedWrongly", {
        victim: c.victim,
        weapon: correct ? c.solution.weapon : weapon,
        room: correct ? c.solution.room : room,
      }),
  };
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
