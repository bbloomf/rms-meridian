// Mechanical checks on a dialogue file. Catches the things an LLM gets wrong
// that a reviewer would miss: bad slots, hard-coded facts, missing keys.
//
//   node src/dialogue/validate.ts [character ...]   validate content/dialogue/*.json

import { readFileSync, readdirSync } from "node:fs";
import { CAST, CHAR_IDS, ROOMS, WEAPONS } from "../data.ts";
import type { CharId } from "../data.ts";
import { SLOT_PATTERN, TOPICS, keysFor, topicOf } from "./schema.ts";
import type { DialogueFile } from "./schema.ts";

export interface Issue {
  key: string;
  line?: string;
  problem: string;
}

const ROOM_NAMES = [...Object.values(ROOMS).map((r) => r.name), "Promenade", "Saloon", "Verandah"];
const WEAPON_WORDS = /\b(belaying|champagne|quoit|sextant|marlinspike|poison|letter opener|rope)\b/i;
const TIME_WORDS = /\b\d{1,2}[:.]\d{2}\b|o'clock|half past|quarter (past|to)/i;

function namePatterns(c: CharId): RegExp[] {
  const [first, surname] = CAST[c].name.split(" ");
  return [new RegExp(`\\b${first}\\b`), new RegExp(`\\b${surname}\\b`)];
}

const normalise = (slot: string) => slot[0].toLowerCase() + slot.slice(1);

export function validateDialogue(file: DialogueFile): Issue[] {
  const issues: Issue[] = [];
  const speaker = file.character;
  const expected = keysFor(speaker);

  for (const key of Object.keys(file.lines)) {
    if (!expected.includes(key)) issues.push({ key, problem: "unexpected key" });
  }

  for (const key of expected) {
    const lines = file.lines[key];
    const { topic, about } = topicOf(key);
    const spec = TOPICS[topic];
    if (!lines || lines.length === 0) {
      issues.push({ key, problem: "missing" });
      continue;
    }
    if (lines.length < spec.variants) issues.push({ key, problem: `only ${lines.length} variants, want ${spec.variants}` });
    const seen = new Set<string>();

    for (const line of lines) {
      const fail = (problem: string) => issues.push({ key, line, problem });
      if (seen.has(line)) fail("duplicate");
      seen.add(line);
      if (line.trim() !== line || line.length === 0) fail("blank or untrimmed");
      if (line.length > spec.maxLength) fail(`too long (${line.length} > ${spec.maxLength})`);

      const slots = [...line.matchAll(SLOT_PATTERN)].map((m) => normalise(m[1]));
      for (const s of slots) if (!spec.allowed.includes(s)) fail(`slot {${s}} not allowed here`);
      for (const group of spec.required) {
        if (!group.some((s) => slots.includes(s))) fail(`needs one of ${group.map((s) => `{${s}}`).join(" ")}`);
      }
      if (line.replace(SLOT_PATTERN, "").match(/[{}]/)) fail("malformed slot");
      if (spec.forbid?.test(line)) fail(`contains ${line.match(spec.forbid)![0]}`);

      const bare = line.replace(SLOT_PATTERN, "");
      for (const c of CHAR_IDS) {
        if (c === speaker || c === about) continue;
        if (namePatterns(c).some((p) => p.test(bare))) fail(`names ${CAST[c].name} directly; use a slot`);
      }
      for (const room of ROOM_NAMES) if (bare.includes(room)) fail(`names a room (${room}); use a slot`);
      if (topic !== "accusedRightly" && topic !== "accusedWrongly" && WEAPON_WORDS.test(bare)) {
        fail(`mentions a weapon (${bare.match(WEAPON_WORDS)![0]})`);
      }
      if (TIME_WORDS.test(bare)) fail("hard-codes a time; use {time}");
    }
  }
  return issues;
}

export function loadFile(path: string | URL): DialogueFile {
  return JSON.parse(readFileSync(path, "utf8")) as DialogueFile;
}

if (import.meta.main) {
  const dir = new URL("../../content/dialogue/", import.meta.url);
  const wanted = process.argv.slice(2);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && (wanted.length === 0 || wanted.includes(f.replace(".json", ""))));
  let total = 0;
  for (const f of files) {
    const file = loadFile(new URL(f, dir));
    const issues = validateDialogue(file);
    const lineCount = Object.values(file.lines).reduce((n, l) => n + l.length, 0);
    console.log(`${f}: ${lineCount} lines, ${issues.length} issue(s)`);
    for (const i of issues) console.log(`  [${i.key}] ${i.problem}${i.line ? `: "${i.line}"` : ""}`);
    total += issues.length;
  }
  process.exit(total > 0 ? 1 : 0);
}
