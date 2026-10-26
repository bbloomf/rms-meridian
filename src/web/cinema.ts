// Full-screen sequences that play over the page: the opening titles and the
// accusation. They live outside #app so the page can re-render underneath.
// Timing is all CSS (animation delays in style.css); skipping adds .skip,
// which jumps every animation to its end state.

import { CAST, ROOMS, WEAPONS } from "../data.ts";
import type { CharId, RoomId, WeaponId } from "../data.ts";
import { portrait } from "./art.ts";
import { nightScene } from "./liner.ts";
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

export function playIntro(): Promise<void> {
  const html = `${nightScene()}
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
