# RMS Meridian

A ten-minute murder mystery aboard a 1920s ocean liner, with a new generated case every day. Needs Node 23.6+ (runs TypeScript directly).

## Playing

```
npm install
npm run dev      # http://localhost:8027 (today's daily case; ?case=123 for a specific one)
npm run build    # bundle to web/dist/ for static hosting (serve the web/ folder)
npm test
```

The game is static: the generator, solver and dialogue all run in the browser, so `web/` can be hosted anywhere. Every push to `main` tests, builds and publishes `web/` to GitHub Pages at https://bbloomf.github.io/rms-meridian/ (`.github/workflows/pages.yml`). `web/market-place.html`, a stand-alone remake of MECC's *The Market Place*, is served alongside it at `/rms-meridian/market-place.html`. Progress on each case is kept in the browser's local storage, and saves untouched for 30 days are cleared. A daily case left unfinished at UTC midnight stays open until it's finished or the next one is begun (`?today` skips it).

- `src/game.ts`: the rules for one play-through. A game is a list of moves; `play()` rebuilds the state from them, which is how saving and resuming work.
- `src/hint.ts`: the beginner's "Where do I start?" / "What next?" advisor (see below).
- `src/web/main.ts`: the front end (briefing, timeline, rooms, weapons, interviews, accusation, verdict and share text). `web/style.css` holds the styles and animations.
- `src/web/art.ts`: character icons, and the stage that draws an account the way the suspect tells it: a room, a clock and the people in it.
- `src/web/ink.ts`: the pen-and-ink kit. One SVG filter wobbles and roughens every line like a dip pen on rough paper, and hatching patterns stand in for shading. They're added to the page once and shared by every drawing.
- `src/web/rooms.ts`: the 11 rooms, drawn in one-point perspective. Positions are given against the back wall plus a depth, so furniture lines up with the floor. They appear in the scenes, on the room cards and in the murder-night replay.
- `src/web/weapons.ts`: the 8 weapons, shown on the weapons list, in the accusation picker and on the accusation card.
- `src/web/cinema.ts`: the full-screen opening titles and the accusation sequence. Both can be skipped, and are left out entirely when the browser asks for reduced motion.
- `src/web/music.ts`: the opening theme, a small synthesized orchestra in Web Audio (no sound files).

### Animations

- **Opening:** on a fresh case, the Meridian sails in under the stars, its portholes light up, and the title and "a scream on the Boat Deck" fade in (about 7 seconds). The theme is scored like a film-orchestra main title. A harp glissando under a cymbal swell, then French horns take a farewell in the manner of *The Leaving of Liverpool*, violins soaring an octave above, over string chords, harp and timpani. At the scream the full brass breaks it off on a dissonant chord with a tam-tam, and a celesta picks the tune out in G minor over tremolo low strings, dying away under the briefing. Browsers often block sound before the first click, so when they do the intro waits on its first frame behind a **Play Intro** button. It also has a **Play music** button that starts the theme in step with the animation; **Mute** is remembered (`meridian-sound` in local storage), and with sound off the intro doesn't wait.
- **Accounts as scenes:** asking a suspect draws the scene the way they tell it: the room, the clock at that time, and the people they say were there. An account nobody confirms is sepia and marked "As told"; one that names a witness gets a "Corroborated" stamp. Click any answer in the timeline to see its scene again.
- **Confrontation:** a suspect who holds firm makes the scene shudder and get stamped "Doubtful". One who cracks makes it split down the middle and fall away, revealing the room they were really in, stamped "Lied".
- **Search:** a lantern sweeps across the room tile; the murder room flashes red.
- **Accusation:** everyone gathered in the Grand Saloon; a spotlight sweeps along the suspects and settles on the accused; your words, their reply, then killer/weapon/room cards flip to ✓ or ✗ and the stamp lands ("Case closed" or "Wrong name").
- **What really happened:** the verdict replays the true night on a deck plan of the case's rooms. Tokens move from room to room at 10:00, 10:15, 10:30 and 10:45 as the clock turns. Then the replay stops on the murder (with the killer's claimed alibi as a dashed token), the weapon carried off to its hiding place, and each red herring's claimed room against their real one. Play, step back and step forward; with reduced motion it's a still step-through with no Play button (`src/web/replay.ts`).

## Hints for beginners

The **Where do I start?** button in the notebook's header (later **What next?**) opens a card from "your sergeant". It names one move, explains why in a sentence or two, and makes that move's button glow. **Do it** makes the move, which costs the usual action. When the case is settled it offers to open the accusation with the answer and the best three pins filled in.

- The advice reasons only from what the player has turned up and the rules they were told: physical evidence first, then accounts of the time of death, a confrontation when a non-proud suspect's lie shows, a question that could show the victim alive later, and finally whatever proof is still missing. `src/hint.test.ts` checks it never reads the solution, the schedule, the secrets, unasked testimony, or whether an answer was a lie.
- Following every hint solves 500 of 500 test seeds (one by a lucky guess at midnight) in a median of 9 actions, with three stars 95% of the time.
- Hints are free, but the verdict and the share text count them (💡).

## Command line

```
node src/cli.ts 42 --spoil     # case from seed 42, with solution
node src/cli.ts 8 --dialogue   # testimony as spoken lines (characters with templates)
node src/cli.ts --daily        # today's daily case
node src/cli.ts --stats 500    # generate 500 cases and summarise
npm run typecheck
```

## Rules the player is told

1. The murder happened in one of the rooms in play, with one of the weapons in play.
2. No one witnessed it: the killer was alone with the victim.
3. Physical evidence never lies.
4. Suspects may lie about where they were, but never invent a sighting. So anyone who names who they saw is telling the truth.
5. Confront a suspect with someone else's account of the same time. If the accounts contradict, an innocent liar confesses their secret, unless they hold firm out of pride (Martin Marble, Mary Mallet). The killer always holds firm. A baseless confrontation still costs the action.
6. Accuse once: name the killer, weapon and room, and pin up to three pieces of evidence as proof.

## Proof and rating

Anything you've turned up can be pinned: signs of a struggle, a weapon missing from its place or found hidden, an account that names a witness, a confrontation someone held firm through, or a confession. Each part of the answer counts as proven when it's right and one of your pins supports it:

- **Room:** the struggle in that room.
- **Weapon:** that weapon missing from its place, or found hidden.
- **Killer:** catching them in a lie during the time of death. Pin the account that contradicts theirs (you must have asked them about that time too), or the confrontation they held firm through.

The verdict marks each pin ✓ or ✗ and explains why. Stars: one for the right answer, one for proving all three parts, one for finishing with 3 or more actions left. The share text adds a 📌 per proven part.

The generator now only accepts cases where the killer's lie at the murder time can be contradicted (about three in four candidates qualified already), so a full proof is always possible. With hindsight, a fully proven solve takes 5 to 10 actions (median 7, over 300 seeds); `src/game.test.ts` checks every test seed can be fully proven within budget.

## How it works

- `src/data.ts`: cast, rooms, weapons, time slots, phrase helpers.
- `src/generate.ts`: builds a candidate backwards from the solution (schedules, the killer's false alibi, innocents' secrets, testimony, search results).
- `src/solver.ts`: deduces from player-visible evidence only. Rejects candidates unless exactly one killer/weapon/room survives, and measures the cost (hindsight-minimum questions, average searches in random order).
- One action = search a room, ask one suspect about one time slot, or confront. Small talk is free. Budget: 15.

## Dialogue pipeline

Scripted dialogue, written offline by an LLM and shipped as JSON. No LLM runs at play time.

- `src/dialogue/bibles.ts`: world and tone guide, plus a bible per character: voice, habits, and how they address and regard each other character.
- `src/dialogue/schema.ts`: the topics (whereabouts, sightings, confrontation, accusation, opinions, eulogies), their slots and variant counts.
- `src/dialogue/pipeline.ts`: calls Claude (`claude-opus-5-5`, structured JSON output, refusal fallback on) once per character. It validates the result and asks for fixes up to twice. Files that still fail are written as `<id>.draft.json`.
- `src/dialogue/validate.ts`: checks slots, required slots, lengths, duplicates, and hard-coded names, rooms, weapons and times.
- `src/dialogue/render.ts`: fills slots from case facts. Each speaker cycles through variants in seeded order, so lines don't repeat until the pool runs out.
- `content/dialogue/*.json`: the templates. All six characters are done (written in a Claude Code session in the pipeline's format; the pipeline itself has not yet been run against the API).

```
npm run generate-dialogue -- folder mallet bear pail   # needs ANTHROPIC_API_KEY or `ant auth login`
npm run generate-dialogue -- folder --dry-run          # print the prompt only
npm run validate-dialogue
```

Whereabouts and "saw no one" lines come from a single pool shared by true answers and lies, so the wording never gives a liar away.

## Known tuning questions (need playtesting)

- A player who searches in random order and asks random questions about the time of death, without confronting anyone, runs out of actions with more than one suspect left in about 1 case in 4 (a simulation over 500 seeds). That's a fair challenge for a deduction game, but it's why the hints exist.
- Hints make three stars easy. They're counted in the share text; whether they should also cost a star is a design call.

- The budget estimate uses hindsight for questions, so real players will need more than "estimated actions".
- Murders only happen in public rooms, which players may learn to exploit.
- Confrontation: holding firm only means something for the four suspects who aren't proud. Catching one of them in a lie and confronting them settles whether they're the killer. That rewards finding the contradiction, but it may make cases with those killers too easy. The solver doesn't use confrontation, so every case can still be solved without it.
- Rating: the thrift star needs 3+ actions to spare (`THRIFTY` in `src/game.ts`). Set by guesswork; adjust after playtests.
- Proving the killer always means a lie during the time of death, so a proud innocent who lied in that window looks just like the killer on proof alone. The pin only scores if the accusation is right, but players may find that confusing.
- The accusation sequence runs about 8 seconds. It may want to be shorter on replays (or skippable by default after the first time).
