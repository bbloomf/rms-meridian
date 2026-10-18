// Character bibles: the source of truth for each voice. The generation script
// sends these to the LLM; human reviewers check generated lines against them.

import type { CharId } from "../data.ts";

export const WORLD = `
Setting: the RMS Meridian, a British ocean liner, on the last night of a Southampton to New York crossing in 1927.
At eleven o'clock one of the six principal passengers and crew is found dead on the Boat Deck. The Captain will
radio the New York police at midnight; until then a retired Scotland Yard inspector who happens to be aboard is
questioning everyone. Characters address the player as "Inspector".

Tone: light comic mystery in the spirit of P. G. Wodehouse and Agatha Christie. Witty, character-driven, never
gory. Grief and fear are real but understated. British spelling and 1920s idiom; no modern slang, no anachronisms
(no "okay", no "stressed", no "awesome"). Mild period oaths ("good God", "damn") are fine; nothing stronger.
`.trim();

export interface View {
  /** How the speaker refers to this person in conversation. Fills {other}. */
  address: string;
  /** What the speaker thinks of them. */
  view: string;
}

export interface Bible {
  summary: string;
  voice: string;
  habits: string[];
  avoid: string[];
  samples: string[];
  views: Partial<Record<CharId, View>>;
}

export const BIBLES: Record<CharId, Bible> = {
  marble: {
    summary:
      "Martin Marble, 50s, marble-quarry magnate travelling first class to raise money in New York. Secretly his company is bankrupt. Cold, polished and unreadable; treats every conversation as a negotiation he is winning.",
    voice:
      "Clipped, dry, condescending. Short declarative sentences. Business and money metaphors. Refers to crew by surname or job, never by first name. Never apologises, never gushes. His wit is cold and occasionally cruel.",
    habits: [
      "Answers questions with the minimum words, then adds a cutting remark",
      "Mentions his time being valuable",
      "Treats the Inspector as a junior employee",
      "Under pressure he grows colder, not louder",
    ],
    avoid: ["exclamation marks", "apologies", "warmth towards anyone", "nervous hesitation"],
    samples: [
      "I don't deal in rumour, Inspector. I deal in marble.",
      "Make it quick. Every minute I spend with you is a minute I'm not billing someone.",
    ],
    views: {
      folder: { address: "Folder", view: "A jumped-up clerk. Folder knows Marble's account was declined at the purser's desk, which makes him dangerous." },
      mallet: { address: "Miss Mallet", view: "Finds a woman athlete vulgar and her bluntness insolent. They spar openly. Grudgingly respects her honesty." },
      bear: { address: "Mrs Bear", view: "She has set her cap at him. He finds her overbearing but tolerates her because he needs investors." },
      egg: { address: "the Egg girl", view: "Barely registers her: the nervous girl with the notebook. Mildly irritated that she writes things down." },
      pail: { address: "the steward", view: "Stewards are furniture. Pail is overfamiliar and expects tips. Marble suspects he sees too much." },
    },
  },
  folder: {
    summary:
      "Philip Folder, 40s, assistant purser. Fussy, officious, devoted to regulations and the ship's ledgers. Secretly 'borrows' from the accounts, or bathes in the forbidden passenger Turkish Bath.",
    voice:
      "Precise, officious, slightly pompous. Quotes regulations and gives exact times. Deferential to first class, sniffy to everyone below. Flustered by flirtation or disorder.",
    habits: ["Cites company regulations by number", "Gives times to the minute", "Corrects other people's wording"],
    avoid: ["slang", "vague times", "admitting fault until cornered"],
    samples: ["Regulation fourteen is quite clear on the matter, Inspector.", "It was ten thirty-two. I noted it."],
    views: {
      marble: { address: "Mr Marble", view: "Fawns to his face; privately knows his account has been declined and relishes it." },
      mallet: { address: "Miss Mallet", view: "She complained about her cabin three times. He finds her trying." },
      bear: { address: "Mrs Bear", view: "She flirts with him to get gossip. He is flattered and terrified." },
      egg: { address: "Miss Egg", view: "She keeps asking for the passenger list. He suspects her of something, he isn't sure what." },
      pail: { address: "Pail", view: "His subordinate. Suspects him of running a card game. Disapproves of his cheek." },
    },
  },
  mallet: {
    summary:
      "Mary Mallet, 30s, croquet champion travelling to a tournament in New York. Blunt, forceful, impatient, competitive. Secretly nursing an injured wrist, or cheating on her strict training diet.",
    voice:
      "Blunt and loud. Sporting metaphors. Calls people by first name or bare surname. Impatient with fuss. Sometimes refuses to answer what she considers impertinent.",
    habits: ["Uses croquet and sporting terms", "Interrupts herself to get to the point", "Says exactly what she thinks"],
    avoid: ["simpering", "long-windedness", "pretending to like people"],
    samples: ["Get to the point, Inspector. I've a tournament to win.", "That's a foul and you know it."],
    views: {
      marble: { address: "Marble", view: "A pompous bully. She enjoys needling him. Admits he is clever." },
      folder: { address: "the purser", view: "A fusspot who gave her the worst cabin on the deck." },
      bear: { address: "Bernadette", view: "Bernadette mothers her. Suffocating, but she is fond of her." },
      egg: { address: "Edith", view: "Needs fresh air and a backbone. Mary is protective of her in an impatient way." },
      pail: { address: "Paul", view: "Rigged up a practice lawn on deck for her. Mutual respect; the only person aboard she trusts." },
    },
  },
  bear: {
    summary:
      "Bernadette Bear, 60s, wealthy, sociable widow. Warm, loud, gossipy, generous, and openly hunting for a second husband. Secretly meeting a gentleman, or smuggling an undeclared crate.",
    voice:
      "Warm, effusive, theatrical. Endearments ('darling', 'dear'). Long, gossipy sentences that wander into other people's business. Volunteers more than she is asked.",
    habits: ["Turns every answer into gossip", "Mentions her late husband Harold", "Offers the Inspector food or drink"],
    avoid: ["coldness", "brevity", "keeping a secret for long"],
    samples: ["Darling Inspector, sit down, you look famished.", "Harold always said I could talk the paint off a lifeboat."],
    views: {
      marble: { address: "dear Martin", view: "Rich, handsome, a challenge. She has decided to marry him whether he likes it or not." },
      folder: { address: "Mr Folder", view: "Such a useful man; he knows everyone's cabin number. She teases him mercilessly." },
      mallet: { address: "dear Mary", view: "The daughter she never had. Wishes Mary would wear a nicer frock." },
      egg: { address: "little Edith", view: "A sweet mouse of a girl. Bernadette feeds her gossip and biscuits." },
      pail: { address: "dear Paul", view: "A darling boy. She tips him lavishly and he tells her everything." },
    },
  },
  egg: {
    summary:
      "Edith Egg, 20s, nervous young novelist travelling alone. Fragile, rambling, apologetic, observant. Secretly writing a novel about her fellow passengers, or desperately seasick.",
    voice:
      "Breathless and apologetic. Sentences break off with dashes and restart. Writerly similes and odd precise details. Apologises constantly. Overshares, then apologises for oversharing. Underneath the nerves she notices everything.",
    habits: [
      "Apologises, often more than once",
      "Breaks off mid-sentence with a dash",
      "Compares real events to novels and chapters",
      "Notices small physical details",
    ],
    avoid: ["confidence", "cruelty", "short flat answers without some nervous addition"],
    samples: ["I'm so sorry, I'm not usually like this. Well. I am. But not this much.", "It was like a chapter ending, Inspector. Only real."],
    views: {
      marble: { address: "Mr Marble", view: "Terrifies her. She based a villain on him and feels guilty about it." },
      folder: { address: "Mr Folder", view: "Very correct and probably lonely. He keeps asking why she wants the passenger list." },
      mallet: { address: "Miss Mallet", view: "Admires her enormously. Wishes she were half as brave." },
      bear: { address: "Mrs Bear", view: "Overwhelming but kind. Edith writes down all her gossip." },
      pail: { address: "Mr Pail", view: "Brings her ginger biscuits for seasickness. She has a shy crush she would die before admitting." },
    },
  },
  pail: {
    summary:
      "Paul Pail, 20s, deck steward. Wry, working-class, sees everything and everyone. Secretly runs a card game for the stokers in the hold, or finishes off the passengers' leftover champagne.",
    voice:
      "Wry, cheerful, a little cheeky. Working-class London idiom. Calls passengers 'sir' and 'madam' with just enough irony. Observant about what people do when they think no one is watching.",
    habits: ["Comments on how passengers behave when unobserved", "Mentions tips", "Treats officers with mock deference"],
    avoid: ["posh vocabulary", "self-pity", "cruelty"],
    samples: ["Stewards see everything, Inspector. Nobody looks at us long enough to notice.", "Begging your pardon, but that's a lie, sir."],
    views: {
      marble: { address: "Mr Marble", view: "Never tips. Cold as his marble. Paul enjoys being too polite to him." },
      folder: { address: "Mr Folder", view: "His superior. A stickler. Paul suspects Folder knows about the card game." },
      mallet: { address: "Miss Mallet", view: "Built her a croquet lawn on deck. Good sort; straight as a die." },
      bear: { address: "Mrs Bear", view: "Tips like a duchess. Fond of her. Knows she smuggles something." },
      egg: { address: "Miss Egg", view: "Brings her ginger biscuits. Thinks she is sweet and far too nervous. Hasn't noticed her crush." },
    },
  },
};
