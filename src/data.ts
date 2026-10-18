// Fixed content for the RMS Meridian, 1927: cast, rooms, weapons and time slots.

export type CharId = "marble" | "folder" | "mallet" | "bear" | "egg" | "pail";
export type RoomId =
  | "saloon"
  | "smoking"
  | "promenade"
  | "library"
  | "verandah"
  | "turkish"
  | "ballroom"
  | "wireless"
  | "galley"
  | "purser"
  | "cargo";
export type WeaponId =
  | "belayingPin"
  | "champagne"
  | "quoit"
  | "sextant"
  | "marlinspike"
  | "poison"
  | "letterOpener"
  | "rope";

export interface Pronouns {
  subject: string; // he / she
  object: string; // him / her
  possessive: string; // his / her
}

const HE: Pronouns = { subject: "he", object: "him", possessive: "his" };
const SHE: Pronouns = { subject: "she", object: "her", possessive: "her" };

/** A harmless secret an innocent suspect lies about. They were really in `room`. */
export interface Secret {
  id: string;
  room: RoomId;
  confession: string;
}

export interface Character {
  id: CharId;
  name: string;
  short: string;
  pronouns: Pronouns;
  role: string;
  crew: boolean;
  /** Too proud to back down when caught in a lie, guilty or not. */
  holdsFirm: boolean;
  secrets: Secret[];
}

export interface Room {
  id: RoomId;
  name: string;
  crewOnly: boolean;
  on?: boolean; // "on the Promenade Deck" rather than "in"
}

export interface Weapon {
  id: WeaponId;
  name: string;
  /** Rooms where this weapon is normally kept, in order of preference. */
  homes: RoomId[];
}

export const CAST: Record<CharId, Character> = {
  marble: {
    id: "marble",
    name: "Martin Marble",
    short: "Marble",
    pronouns: HE,
    role: "marble-quarry magnate, first class",
    crew: false,
    holdsFirm: true,
    secrets: [
      {
        id: "cable",
        room: "wireless",
        confession:
          "My company is bankrupt. I was bribing the wireless operator to cable my bank before New York hears of it.",
      },
      {
        id: "cards",
        room: "smoking",
        confession: "I lost a small fortune at cards and could not be seen to have done so.",
      },
    ],
  },
  folder: {
    id: "folder",
    name: "Philip Folder",
    short: "Folder",
    pronouns: HE,
    role: "assistant purser",
    crew: true,
    holdsFirm: false,
    secrets: [
      {
        id: "ledger",
        room: "purser",
        confession: "I was adjusting the ledger. A small discrepancy. Entirely temporary.",
      },
      {
        id: "bath",
        room: "turkish",
        confession: "Crew are forbidden the passenger facilities. I was in the Turkish Bath.",
      },
    ],
  },
  mallet: {
    id: "mallet",
    name: "Mary Mallet",
    short: "Mallet",
    pronouns: SHE,
    role: "croquet champion",
    crew: false,
    holdsFirm: true,
    secrets: [
      {
        id: "wrist",
        room: "ballroom",
        confession:
          "I was practising my swing in the empty Ballroom. My wrist is injured and no one must know before the tournament.",
      },
      {
        id: "pantry",
        room: "galley",
        confession: "I was raiding the pantry. My trainer has me on the strictest diet.",
      },
    ],
  },
  bear: {
    id: "bear",
    name: "Bernadette Bear",
    short: "Bear",
    pronouns: SHE,
    role: "wealthy widow",
    crew: false,
    holdsFirm: false,
    secrets: [
      {
        id: "gentleman",
        room: "verandah",
        confession: "I was meeting a gentleman. A widow is permitted a little company, surely.",
      },
      {
        id: "crate",
        room: "cargo",
        confession: "I was checking on a crate of my late husband's. It is not, strictly speaking, declared.",
      },
    ],
  },
  egg: {
    id: "egg",
    name: "Edith Egg",
    short: "Egg",
    pronouns: SHE,
    role: "nervous young novelist",
    crew: false,
    holdsFirm: false,
    secrets: [
      {
        id: "novel",
        room: "library",
        confession: "I was writing about all of you. My novel is set aboard this ship. I'm so sorry.",
      },
      {
        id: "seasick",
        room: "promenade",
        confession: "I was being sick over the rail. I couldn't bear anyone knowing.",
      },
    ],
  },
  pail: {
    id: "pail",
    name: "Paul Pail",
    short: "Pail",
    pronouns: HE,
    role: "deck steward",
    crew: true,
    holdsFirm: false,
    secrets: [
      {
        id: "cardgame",
        room: "cargo",
        confession: "I run a card game for the stokers down in the hold. Captain'd have my job.",
      },
      {
        id: "champagne",
        room: "saloon",
        confession: "I was finishing off the champagne the passengers left behind.",
      },
    ],
  },
};

export const ROOMS: Record<RoomId, Room> = {
  saloon: { id: "saloon", name: "Grand Saloon", crewOnly: false },
  smoking: { id: "smoking", name: "Smoking Room", crewOnly: false },
  promenade: { id: "promenade", name: "Promenade Deck", crewOnly: false, on: true },
  library: { id: "library", name: "Library", crewOnly: false },
  verandah: { id: "verandah", name: "Verandah Café", crewOnly: false },
  turkish: { id: "turkish", name: "Turkish Bath", crewOnly: false },
  ballroom: { id: "ballroom", name: "Ballroom", crewOnly: false },
  wireless: { id: "wireless", name: "Wireless Room", crewOnly: true },
  galley: { id: "galley", name: "Galley", crewOnly: true },
  purser: { id: "purser", name: "Purser's Office", crewOnly: true },
  cargo: { id: "cargo", name: "Cargo Hold", crewOnly: true },
};

export const WEAPONS: Record<WeaponId, Weapon> = {
  belayingPin: { id: "belayingPin", name: "belaying pin", homes: ["promenade", "cargo"] },
  champagne: { id: "champagne", name: "champagne bottle", homes: ["saloon", "ballroom", "verandah"] },
  quoit: { id: "quoit", name: "deck quoit", homes: ["promenade", "verandah"] },
  sextant: { id: "sextant", name: "sextant", homes: ["library", "wireless"] },
  marlinspike: { id: "marlinspike", name: "marlinspike", homes: ["cargo", "promenade"] },
  poison: { id: "poison", name: "tin of rat poison", homes: ["galley", "cargo"] },
  letterOpener: { id: "letterOpener", name: "letter opener", homes: ["library", "purser"] },
  rope: { id: "rope", name: "coil of rope", homes: ["cargo", "promenade"] },
};

export const CHAR_IDS = Object.keys(CAST) as CharId[];
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export interface Slot {
  label: string; // "10:15"
  phrase: string; // "around a quarter past ten"
}

export const SLOTS: Slot[] = [
  { label: "10:00", phrase: "around ten o'clock" },
  { label: "10:15", phrase: "around a quarter past ten" },
  { label: "10:30", phrase: "around half past ten" },
  { label: "10:45", phrase: "around a quarter to eleven" },
];

// Phrase helpers, so filled-in dialogue doesn't read like a mail merge.
export const the = (room: RoomId): string => `the ${ROOMS[room].name}`;
export const The = (room: RoomId): string => `The ${ROOMS[room].name}`;
export const inRoom = (room: RoomId): string => `${ROOMS[room].on ? "on" : "in"} ${the(room)}`;
