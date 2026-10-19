// Dialogue templates are written per character and per topic, never per case.
// At runtime the generator's facts are poured into the slots.
//
// Slots (a capitalised slot name capitalises the result, e.g. {Other.subject} -> "She"):
//   {room}            "in the Library" / "on the Promenade Deck"
//   {roomName}        "the Library"
//   {time}            "around half past ten"
//   {weapon}          "the sextant"
//   {other}           how the SPEAKER refers to that person ("Folder", "dear Martin", "the steward")
//   {other.full}      "Philip Folder"
//   {other.subject} / {other.object} / {other.possessive}   pronouns
//   {others}          a joined list of address terms ("Folder and Mrs Bear")
//   {victim...}, {witness...}   same fields as {other...}

import { CHAR_IDS } from "../data.ts";
import type { CharId } from "../data.ts";

const person = (p: string) => [p, `${p}.full`, `${p}.subject`, `${p}.object`, `${p}.possessive`];

// Lines shared by true answers and lies must not vouch for themselves or hedge,
// or players read a random line as a tell.
const SINCERITY = "swear|sure|certain|certainly|definitely|honest|honestly|truth|promise|word|believe|exact|exactly|precise|quote|prove|checked|noticed|mystery|straight|clear|embroider\\w*|log";

export type Topic =
  | "greeting"
  | "whereabouts"
  | "sawOne"
  | "sawSeveral"
  | "sawVictim"
  | "sawNoOne"
  | "confrontCrack"
  | "confrontDeflect"
  | "accusedWrongly"
  | "accusedRightly"
  | "accusedPartly"
  | "opinion"
  | "eulogy";

export interface TopicSpec {
  /** What the line is for. Shown to the LLM and to human reviewers. */
  brief: string;
  allowed: string[];
  /** Each inner list: at least one of these slots must appear. */
  required: string[][];
  variants: number;
  maxLength: number;
  /** One key per other cast member (opinion.folder, eulogy.folder, ...). */
  perOther?: boolean;
  /** Words that would make the line contradict facts supplied elsewhere. */
  forbid?: RegExp;
}

export const TOPICS: Record<Topic, TopicSpec> = {
  greeting: {
    brief:
      "First words when the Inspector sits down to question them. The victim, {victim}, has just been found dead on the Boat Deck.",
    allowed: person("victim"),
    required: [],
    variants: 6,
    maxLength: 200,
  },
  whereabouts: {
    brief:
      "Answer to 'Where were you at that time?'. State the place and the time, nothing else. The same pool is used for true answers AND lies, so a line must read the same either way: no hint of evasion or sincerity. Do not mention company, solitude or what they were doing; a separate line covers who they saw.",
    allowed: ["room", "roomName", "time"],
    required: [["room", "roomName"], ["time"]],
    variants: 8,
    maxLength: 160,
    forbid: new RegExp(`\\b(alone|by myself|nobody|no one|everyone|together|with|${SINCERITY})\\b`, "i"),
  },
  sawOne: {
    brief:
      "Follows the whereabouts line: who else was there? Exactly one person, {other}. Do not mention the place or time again.",
    allowed: person("other"),
    required: [person("other")],
    variants: 6,
    maxLength: 160,
  },
  sawSeveral: {
    brief:
      "Follows the whereabouts line: several people were there, given as a ready-joined list {others} (e.g. 'Folder and Mrs Bear'). Treat it as plural. The list may include the victim, seen alive, so don't vouch for or condemn everyone in it. Do not mention the place or time again.",
    allowed: ["others"],
    required: [["others"]],
    variants: 6,
    maxLength: 160,
  },
  sawVictim: {
    brief:
      "Follows the whereabouts line: the only person they saw there was {victim}, alive, not long before the murder. (Seen in company, the victim is named in the sawSeveral list instead.)",
    allowed: person("victim"),
    required: [person("victim")],
    variants: 6,
    maxLength: 180,
  },
  sawNoOne: {
    brief:
      "Follows the whereabouts line: they saw no one. Used for true answers AND lies, so a line must read the same either way: no hint of evasion or sincerity. Do not mention the place or time.",
    allowed: [],
    required: [],
    variants: 6,
    maxLength: 140,
    forbid: new RegExp(`\\b(${SINCERITY})\\b`, "i"),
  },
  confrontCrack: {
    brief:
      "The Inspector shows them that {witness}'s testimony contradicts their alibi. They give in. Their confession of a harmless secret is shown immediately after this line, so lead into it without stating the secret.",
    allowed: person("witness"),
    required: [],
    variants: 4,
    maxLength: 160,
  },
  confrontDeflect: {
    brief:
      "The Inspector shows them that {witness}'s testimony contradicts their alibi. They refuse to change their story.",
    allowed: person("witness"),
    required: [],
    variants: 4,
    maxLength: 160,
  },
  accusedWrongly: {
    brief:
      "The Inspector formally accuses them of murdering {victim} with {weapon} in {roomName}. They are innocent. Do not claim where they were.",
    allowed: [...person("victim"), "weapon", "roomName"],
    required: [],
    variants: 4,
    maxLength: 180,
  },
  accusedRightly: {
    brief:
      "The Inspector correctly accuses them of murdering {victim} with {weapon} in {roomName}. They confess, in character. A motive may be hinted at, but it must fit their character bible, and any cast member could be the victim, so it must not depend on who the victim is.",
    allowed: [...person("victim"), "weapon", "roomName"],
    required: [[...person("victim"), "weapon", "roomName"]],
    variants: 4,
    maxLength: 220,
  },
  accusedPartly: {
    brief:
      "The Inspector rightly names them as {victim}'s killer, but gets the weapon, the room or both wrong. They confess, in character, and set the record straight: it was {weapon}, {room}. Name both, since the line is used whichever part was wrong.",
    allowed: [...person("victim"), "weapon", "room"],
    required: [["weapon"], ["room"]],
    variants: 4,
    maxLength: 200,
  },
  opinion: {
    brief: "Asked what they make of {other}, who is alive and also a suspect.",
    allowed: person("other"),
    required: [],
    variants: 3,
    maxLength: 180,
    perOther: true,
  },
  eulogy: {
    brief: "Asked about {other}, who is the murder victim and now dead.",
    allowed: person("other"),
    required: [],
    variants: 3,
    maxLength: 180,
    perOther: true,
  },
};

export const TOPIC_IDS = Object.keys(TOPICS) as Topic[];

/** All template keys a character's file must contain. */
export function keysFor(speaker: CharId): string[] {
  return TOPIC_IDS.flatMap((t) =>
    TOPICS[t].perOther ? CHAR_IDS.filter((c) => c !== speaker).map((c) => `${t}.${c}`) : [t],
  );
}

export function topicOf(key: string): { topic: Topic; about: CharId | null } {
  const [topic, about] = key.split(".") as [Topic, CharId | undefined];
  return { topic, about: about ?? null };
}

export interface DialogueFile {
  character: CharId;
  source: { model: string; generatedAt: string; note?: string };
  lines: Record<string, string[]>;
}

export const SLOT_PATTERN = /\{([A-Za-z]+(?:\.[a-z]+)?)\}/g;
