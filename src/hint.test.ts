// node --test src/hint.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { play, rank } from "./game.ts";
import type { GameState, Move } from "./game.ts";
import { deduce, hint } from "./hint.ts";
import { AP_BUDGET, generateCase } from "./solver.ts";
import type { Case } from "./generate.ts";

const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);

/** Follow every hint from a fresh case to the accusation. */
function follow(c: Case): { state: GameState; states: GameState[] } {
  const moves: Move[] = [];
  const states: GameState[] = [];
  for (let i = 0; i <= AP_BUDGET + 1; i++) {
    const s = play(c, moves);
    states.push(s);
    const h = hint(s);
    assert.ok(h, `seed ${c.seed}: no hint before the accusation`);
    if (h.kind === "accuse") {
      moves.push({ kind: "accuse", who: h.who, weapon: h.weapon, room: h.room, pins: h.pins });
      return { state: play(c, moves), states };
    }
    moves.push(h.move);
  }
  throw new Error(`seed ${c.seed}: hints never reached an accusation`);
}

test("following the hints solves and proves nearly every case", () => {
  let solved = 0;
  let proven = 0;
  for (const seed of SEEDS) {
    const { state } = follow(generateCase(seed).case);
    assert.ok(state.remaining >= 0);
    if (state.accusation!.solved) solved++;
    if (rank(state)!.proven === 3) proven++;
  }
  assert.ok(solved >= SEEDS.length - 1, `solved ${solved} of ${SEEDS.length}`);
  assert.ok(proven >= SEEDS.length - 2, `proved ${proven} of ${SEEDS.length}`);
});

test("hint deductions never rule out the truth", () => {
  for (const seed of SEEDS) {
    const c = generateCase(seed).case;
    for (const s of follow(c).states) {
      const d = deduce(s);
      assert.ok(d.killers.includes(c.solution.killer), `seed ${seed}: killer`);
      assert.ok(d.weapons.includes(c.solution.weapon), `seed ${seed}: weapon`);
      assert.ok(d.rooms.includes(c.solution.room), `seed ${seed}: room`);
    }
  }
});

// A copy of the state whose case has nothing the player hasn't seen: no
// solution, schedule or secrets, and testimony only for questions asked.
function playerView(s: GameState): GameState {
  const { solution, schedule, secrets, testimony, ...open } = s.case;
  void solution, schedule, secrets;
  const seen = Object.fromEntries(
    Object.entries(testimony).map(([who, sts]) => [
      who,
      new Proxy(sts, {
        get(target, key) {
          const slot = Number(key);
          if (Number.isInteger(slot) && !s.answers[who as keyof typeof s.answers]?.[slot]) throw new Error(`hint read unasked testimony ${who}@${slot}`);
          return Reflect.get(target, key);
        },
      }),
    ]),
  );
  const answers = Object.fromEntries(
    Object.entries(s.answers).map(([who, sts]) => [who, sts!.map((st) => st && new Proxy(st, { get: (t, k) => (k === "lie" ? assert.fail("hint read whether an answer was a lie") : Reflect.get(t, k)) }))]),
  );
  const guard = new Proxy(open, {
    get(target, key) {
      if (key === "solution" || key === "schedule" || key === "secrets") throw new Error(`hint read case.${String(key)}`);
      return key === "testimony" ? seen : Reflect.get(target, key);
    },
  });
  return { ...s, case: guard as Case, answers };
}

test("hints use only what the player has seen", () => {
  for (const seed of SEEDS.slice(0, 60)) {
    for (const s of follow(generateCase(seed).case).states) {
      assert.deepEqual(hint(playerView(s)), hint(s), `seed ${seed}`);
    }
  }
});

test("there are no hints once the case is closed", () => {
  const { state } = follow(generateCase(9).case);
  assert.equal(hint(state), null);
});
