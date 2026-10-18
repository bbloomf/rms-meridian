// Full-screen sequences that play over the page: the opening titles and the
// accusation. They live outside #app so the page can re-render underneath.
// Timing is all CSS (animation delays in style.css); skipping adds .skip,
// which jumps every animation to its end state.

import { CAST, ROOMS, WEAPONS } from "../data.ts";
import type { CharId, RoomId, WeaponId } from "../data.ts";
import { portrait } from "./art.ts";
import { weaponPic } from "./weapons.ts";

export const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Mounts an overlay and resolves once it has been dismissed. */
function mount(cls: string, label: string, html: string, finish: (el: HTMLElement, close: () => void) => void): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = `cinema ${cls}`;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", label);
    el.innerHTML = html;
    document.body.append(el);
    document.body.classList.add("cinema-open");
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey);
      el.classList.add("leaving");
      setTimeout(() => {
        el.remove();
        document.body.classList.remove("cinema-open");
        resolve();
      }, 350);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.querySelector<HTMLElement>("[data-cinema]")?.click();
      }
    };
    document.addEventListener("keydown", onKey);
    finish(el, close);
    el.querySelector<HTMLElement>("[data-cinema]")?.focus();
  });
}

// ── Opening ───────────────────────────────────────────────────────────────

/** Deterministic star field, so the sky doesn't reshuffle between visits. */
function stars(): string {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 70 }, () => {
    const x = (r() * 800).toFixed(0);
    const y = (r() * 230).toFixed(0);
    return `<circle class="star" style="--d:${(r() * 3).toFixed(2)}s" cx="${x}" cy="${y}" r="${(0.6 + r() * 1.1).toFixed(1)}" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  }).join("");
}

function ship(): string {
  const portholes = Array.from({ length: 34 }, (_, i) => `<rect class="lamp" style="--i:${i % 17}" x="${150 + i * 15}" y="306" width="5" height="4" rx="1"/>`).join("");
  const windows = Array.from({ length: 24 }, (_, i) => `<rect class="lamp" style="--i:${(i * 5) % 17}" x="${214 + i * 16}" y="262" width="8" height="6"/>`).join("");
  const upper = Array.from({ length: 15 }, (_, i) => `<rect class="lamp" style="--i:${(i * 3) % 17}" x="${272 + i * 18}" y="232" width="8" height="6"/>`).join("");
  const funnels = [330, 410, 490, 570]
    .map(
      (x, i) =>
        `<path d="M${x} 222h34l10-70h-34z" class="funnel"/><path d="M${x + 6} 168h34" class="band"/><g class="smoke" style="--i:${i}"><circle cx="${x + 26}" cy="140" r="9"/><circle cx="${x + 40}" cy="128" r="12"/><circle cx="${x + 58}" cy="118" r="15"/></g>`,
    )
    .join("");
  return `<g class="ship">
    <path class="mast" d="M190 290V150M650 290V160M190 150L650 160"/>
    ${funnels}
    <path class="hull" d="M200 290h420v-40H200zM250 250h340v-28H250zM222 222h96v-22h-96z"/>
    <path class="hull" d="M96 290h630l-14 44q-6 12-24 12H160q-28-4-48-26z"/>
    <path class="trim" d="M110 318h606"/>
    ${portholes}${windows}${upper}
  </g>`;
}

export function playIntro(): Promise<void> {
  const html = `<svg class="night" viewBox="0 0 800 450" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g class="sky">${stars()}<circle class="moon" cx="640" cy="80" r="26"/></g>
      ${ship()}
      <g class="sea"><rect class="water" x="0" y="336" width="800" height="120"/>${[350, 372, 396, 424].map((y, i) => `<path class="wave" style="--i:${i}" d="M-200 ${y}${"q25 -6 50 0t50 0".repeat(24)}"/>`).join("")}</g>
    </svg>
    <div class="c-titles">
      <p class="c-eyebrow">Southampton &middot; New York</p>
      <h1>RMS Meridian</h1>
      <p class="c-sub">The last night of the crossing, 1927</p>
    </div>
    <p class="c-scream">Eleven o'clock. A scream on the Boat Deck.</p>
    <button type="button" class="c-skip" data-cinema>Skip</button>`;
  return mount("intro", "RMS Meridian", html, (el, close) => {
    el.querySelector("[data-cinema]")!.addEventListener("click", close);
    el.addEventListener("animationend", (e) => {
      if ((e.target as HTMLElement).classList.contains("c-scream")) setTimeout(close, 700);
    });
  });
}

// ── Accusation ────────────────────────────────────────────────────────────

export interface AccusationScene {
  suspects: CharId[];
  who: CharId;
  weapon: WeaponId;
  room: RoomId;
  right: { who: boolean; weapon: boolean; room: boolean };
  solved: boolean;
  reply: string;
}

export function playAccusation(a: AccusationScene): Promise<void> {
  const at = a.suspects.indexOf(a.who);
  const row = a.suspects
    .map((s, i) => `<div class="c-suspect${s === a.who ? " accused" : ""}" style="--i:${i}">${portrait(s, "xl")}<span>${esc(CAST[s].short)}</span></div>`)
    .join("");
  const card = (k: number, label: string, value: string, ok: boolean, pic = "") =>
    `<div class="c-card ${ok ? "ok" : "bad"}" style="--k:${k}"><div class="c-face front">${label}</div><div class="c-face back"><span>${label}</span>${pic}<strong>${esc(value)}</strong><b>${ok ? "&#10003;" : "&#10007;"}</b></div></div>`;
  const W = WEAPONS[a.weapon].name;
  const html = `<div class="c-stage">
      <p class="c-place">The Grand Saloon. A quarter to midnight.</p>
      <div class="c-row" style="--n:${a.suspects.length};--at:${at}"><div class="spot"></div>${row}</div>
      <p class="c-words">&ldquo;${esc(CAST[a.who].name)}. With the ${esc(W)}, ${ROOMS[a.room].on ? "on" : "in"} the ${esc(ROOMS[a.room].name)}.&rdquo;</p>
      <p class="c-reply">&ldquo;${esc(a.reply)}&rdquo;</p>
      <div class="c-cards">${card(0, "Killer", CAST[a.who].short, a.right.who)}${card(1, "Weapon", W[0].toUpperCase() + W.slice(1), a.right.weapon, weaponPic(a.weapon))}${card(2, "Room", ROOMS[a.room].name, a.right.room)}</div>
      <div class="c-stamp ${a.solved ? "ok" : "bad"}">${a.solved ? "Case closed" : "Wrong name"}</div>
    </div>
    <button type="button" class="c-skip" data-cinema>Skip</button>`;
  return mount("accusation", "The accusation", html, (el, close) => {
    const btn = el.querySelector<HTMLButtonElement>("[data-cinema]")!;
    const ready = () => {
      el.classList.add("skip");
      btn.textContent = "See the verdict";
      btn.classList.add("primary");
    };
    btn.addEventListener("click", () => (el.classList.contains("skip") ? close() : ready()));
    el.addEventListener("animationend", (e) => {
      if ((e.target as HTMLElement).classList.contains("c-stamp")) ready();
    });
  });
}
