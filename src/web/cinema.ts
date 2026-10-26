// Full-screen sequences that play over the page: the opening titles and the
// accusation. They live outside #app so the page can re-render underneath.
// Timing is all CSS (animation delays in style.css); skipping adds .skip,
// which jumps every animation to its end state, and .waiting holds them all
// on the first frame.

import { CAST, ROOMS, WEAPONS } from "../data.ts";
import type { CharId, RoomId, WeaponId } from "../data.ts";
import { portrait } from "./art.ts";
import { nightScene } from "./liner.ts";
import { playTheme, soundBlocked } from "./music.ts";
import type { Theme } from "./music.ts";
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
      const other = e.target instanceof HTMLButtonElement && !e.target.matches("[data-cinema]");
      if (e.key === "Escape" || (!other && (e.key === "Enter" || e.key === " "))) {
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
    <button type="button" class="c-play primary big" hidden>&#9654; Play Intro</button>
    <button type="button" class="c-sound" hidden></button>
    <button type="button" class="c-skip" data-cinema>Skip</button>`;
  return mount("intro", "RMS Meridian", html, (el, close) => {
    const sound = el.querySelector<HTMLButtonElement>(".c-sound")!;
    const show = (on: boolean) => {
      sound.hidden = false;
      sound.textContent = on ? "\u266A Mute" : "\u266A Play music";
    };
    let theme: Theme | null = null;
    let skipped = false;
    const begin = () => {
      el.classList.remove("waiting");
      theme = playTheme(show);
      if (!theme) return;
      const t = theme;
      show(t.playing);
      sound.addEventListener("click", () => (t.playing ? t.mute() : t.unmute()));
    };
    // If the browser won't play the theme yet, hold the first frame until the player asks.
    el.classList.add("waiting");
    void soundBlocked().then((blocked) => {
      if (skipped) return;
      if (!blocked) return begin();
      const play = el.querySelector<HTMLButtonElement>(".c-play")!;
      play.hidden = false;
      play.addEventListener("click", () => {
        play.remove();
        begin();
      });
      play.focus();
    });
    // Skipping cuts the music short; ending on its own lets it play out under the briefing.
    el.querySelector("[data-cinema]")!.addEventListener("click", () => {
      skipped = true;
      theme?.stop(0.6);
      close();
    });
    // Hold the last frame long enough to read the scream line.
    el.addEventListener("animationend", (e) => {
      if ((e.target as HTMLElement).classList.contains("c-scream"))
        setTimeout(() => {
          theme?.finish();
          close();
        }, 2500);
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
