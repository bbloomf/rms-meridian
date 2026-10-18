// node --test src/game.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAST, SLOTS } from "./data.ts";
import { MAX_PINS, check, contradicts, evidence, play, rank } from "./game.ts";
import type { Evidence, Move } from "./game.ts";
import { AP_BUDGET, contradictions, generateCase } from "./solver.ts";

const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);

test("the solver's shortest route solves every case within budget", () => {
  for (const seed of SEEDS) {
    const { case: c, report } = generateCase(seed);
    const moves: Move[] = [
      ...report.searchSet.map((room): Move => ({ kind: "search", room })),
      ...report.askSet.map((a): Move => (a.kind === "ask" ? { kind: "ask", who: a.who, slot: a.slot } : { kind: "search", room: a.room })),
      { kind: "accuse", who: c.solution.killer, weapon: c.solution.weapon, room: c.solution.room },
    ];
    const s = play(c, moves);
    assert.ok(s.accusation?.solved, `seed ${seed}`);
    assert.ok(s.remaining >= 0);
    assert.ok(rank(s)!.stars >= 1);
  }
});

test("confronting a real contradiction: innocents crack unless proud, the killer holds firm", () => {
  let cracks = 0;
  for (const seed of SEEDS) {
    const { case: c } = generateCase(seed);
    for (const x of contradictions(c)) {
      assert.ok(contradicts(c, x.who, x.slot, x.witness), `seed ${seed}`);
      const s = play(c, [
        { kind: "ask", who: x.who, slot: x.slot },
        { kind: "ask", who: x.witness, slot: x.slot },
        { kind: "confront", who: x.who, slot: x.slot, witness: x.witness },
      ]);
      const outcome = s.confrontations[0].outcome;
      const expected = x.who === c.solution.killer || CAST[x.who].holdsFirm ? "holdFirm" : "crack";
      assert.equal(outcome, expected, `seed ${seed} ${x.who}`);
      if (outcome === "crack") {
        cracks++;
        assert.equal(s.confrontations[0].truth, c.schedule[x.who][x.slot]);
      }
      assert.equal(s.remaining, AP_BUDGET - 3);
    }
  }
  assert.ok(cracks > 0);
});

test("only lies can be contradicted", () => {
  for (const seed of SEEDS) {
    const { case: c } = generateCase(seed);
    for (const who of c.suspects) for (const witness of c.suspects) for (let slot = 0; slot < SLOTS.length; slot++) {
      if (who !== witness && contradicts(c, who, slot, witness)) assert.ok(c.testimony[who][slot].lie, `seed ${seed}`);
    }
  }
});

test("a baseless confrontation still costs an action", () => {
  const { case: c } = generateCase(7);
  const [a, b] = c.suspects.filter((p) => !c.testimony[p][0].lie);
  const s = play(c, [
    { kind: "ask", who: a, slot: 0 },
    { kind: "ask", who: b, slot: 0 },
    { kind: "confront", who: a, slot: 0, witness: b },
  ]);
  assert.equal(s.confrontations[0].outcome, "baseless");
  assert.equal(s.remaining, AP_BUDGET - 3);
});

test("replaying the same moves gives the same dialogue", () => {
  const { case: c } = generateCase(42);
  const moves: Move[] = [
    { kind: "ask", who: c.suspects[0], slot: 1 },
    { kind: "chat", who: c.suspects[1], about: c.victim },
    { kind: "search", room: c.rooms[0] },
  ];
  assert.deepEqual(play(c, moves).log, play(c, moves).log);
});

test("illegal moves are refused", () => {
  const { case: c } = generateCase(3);
  const ask: Move = { kind: "ask", who: c.suspects[0], slot: 0 };
  assert.match(check(play(c, [ask]), ask)!, /already/);
  const searches = c.rooms.map((room): Move => ({ kind: "search", room }));
  const asks = c.suspects.flatMap((who) => [0, 1].map((slot): Move => ({ kind: "ask", who, slot })));
  const spent = play(c, [...searches, ...asks].slice(0, AP_BUDGET));
  assert.equal(spent.remaining, 0);
  assert.match(check(spent, { kind: "ask", who: c.suspects[0], slot: 3 })!, /out of time/);
  assert.equal(check(spent, { kind: "accuse", who: c.suspects[0], weapon: c.weapons[0], room: c.rooms[0] }), null);
});


// The solver's route plus what proof needs: the murder room, the weapon's
// usual place, and both sides of a contradiction of the killer's alibi.
function provenRoute(seed: number) {
  const { case: c, report } = generateCase(seed);
  const { killer, weapon, room, slot } = c.solution;
  const x = contradictions(c).find((k) => k.who === killer && k.slot === slot)!;
  const rooms = [...new Set([room, c.weaponHome[weapon], ...report.searchSet])];
  const asks = new Map<string, Move>();
  for (const a of [...report.askSet, { kind: "ask", who: killer, slot }, { kind: "ask", who: x.witness, slot }] as const) {
    if (a.kind === "ask") asks.set(`${a.who}:${a.slot}`, { kind: "ask", who: a.who, slot: a.slot });
  }
  const moves: Move[] = [...rooms.map((r): Move => ({ kind: "search", room: r })), ...asks.values()];
  const pins: Evidence[] = [
    { kind: "scene", room },
    { kind: "missing", weapon, room: c.weaponHome[weapon] },
    { kind: "account", who: x.witness, slot },
  ];
  return { c, moves, pins };
}

test("every case can be fully proven within budget", () => {
  for (const seed of SEEDS) {
    const { c, moves, pins } = provenRoute(seed);
    const { killer, weapon, room } = c.solution;
    const s = play(c, [...moves, { kind: "accuse", who: killer, weapon, room, pins }]);
    assert.ok(s.remaining >= 0, `seed ${seed}`);
    assert.deepEqual(s.accusation!.proof, { killer: true, weapon: true, room: true }, `seed ${seed}`);
    assert.equal(rank(s)!.proven, 3);
    assert.ok(rank(s)!.stars >= 2);
  }
});

test("pins prove nothing about the wrong answer", () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const { c, moves, pins } = provenRoute(seed);
    const { killer, weapon, room } = c.solution;
    const other = <T>(xs: T[], x: T) => xs.find((y) => y !== x)!;
    const wrong = { who: other(c.suspects, killer), weapon: other(c.weapons, weapon), room: other(c.rooms, room) };
    const s = play(c, [...moves, { kind: "accuse", ...wrong, pins }]);
    assert.deepEqual(s.accusation!.proof, { killer: false, weapon: false, room: false }, `seed ${seed}`);
    assert.ok(s.accusation!.pins.every((p) => p.supports === null), `seed ${seed}`);
    assert.equal(rank(s)!.stars, 0);
  }
});

test("a correct accusation with no proof earns at most two stars", () => {
  const { c, moves } = provenRoute(11);
  const { killer, weapon, room } = c.solution;
  const s = play(c, [...moves, { kind: "accuse", who: killer, weapon, room }]);
  assert.ok(s.accusation!.solved);
  assert.equal(rank(s)!.proven, 0);
  assert.ok(rank(s)!.stars <= 2);
});

test("only found evidence can be pinned, and only three pieces", () => {
  const { c, moves, pins } = provenRoute(5);
  const { killer, weapon, room } = c.solution;
  const s = play(c, moves);
  const accuse = (p: Evidence[]): Move => ({ kind: "accuse", who: killer, weapon, room, pins: p });
  assert.equal(check(s, accuse(pins)), null);
  assert.match(check(play(c, []), accuse(pins))!, /found/);
  assert.match(check(s, accuse([pins[0], pins[0]]))!, /found/);
  const all = evidence(s);
  if (all.length > MAX_PINS) assert.match(check(s, accuse(all))!, /at most/);
});
