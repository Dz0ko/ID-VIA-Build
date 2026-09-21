"use client";

import { useEffect } from "react";

/**
 * Imperative landing-page effects: reveal on scroll, 3D tilt on [data-tilt],
 * magnetic buttons on [data-magnetic], cursor spotlight on [data-spotlight].
 */
export function LandingFx() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Pointer effects only make sense with a real cursor; on touch they just cost battery.
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll<HTMLElement>(".reveal, .reveal-up, .reveal-left, .reveal-right").forEach((el) => io.observe(el));

    const cleanups: (() => void)[] = [];
    if (!reduced && !coarse) {
      document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => {
        const max = Number(card.dataset.tilt || 8);
        let rect: DOMRect | null = null;
        let raf = 0;
        let last: PointerEvent | null = null;
        const apply = () => {
          raf = 0;
          if (!last || !rect) return;
          const px = (last.clientX - rect.left) / rect.width - 0.5;
          const py = (last.clientY - rect.top) / rect.height - 0.5;
          card.style.transform = `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg) translateY(-4px)`;
          card.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
          card.style.setProperty("--my", `${(py + 0.5) * 100}%`);
        };
        const enter = () => { rect = card.getBoundingClientRect(); card.style.willChange = "transform"; };
        const move = (e: PointerEvent) => { last = e; if (!raf) raf = requestAnimationFrame(apply); };
        const leave = () => { if (raf) cancelAnimationFrame(raf); raf = 0; card.style.transform = ""; card.style.willChange = ""; };
        card.addEventListener("pointerenter", enter); card.addEventListener("pointermove", move, { passive: true }); card.addEventListener("pointerleave", leave);
        cleanups.push(() => { card.removeEventListener("pointerenter", enter); card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", leave); });
      });
      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((btn) => {
        let r: DOMRect | null = null;
        const move = (e: PointerEvent) => {
          if (!r) r = btn.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.18}px)`;
        };
        const reset = () => { r = null; };
        btn.addEventListener("pointerenter", reset);
        cleanups.push(() => btn.removeEventListener("pointerenter", reset));
        const leave = () => { btn.style.transform = ""; };
        btn.addEventListener("pointermove", move); btn.addEventListener("pointerleave", leave);
        cleanups.push(() => { btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerleave", leave); });
      });
      document.querySelectorAll<HTMLElement>("[data-spotlight]").forEach((sec) => {
        let raf = 0; let last: PointerEvent | null = null;
        const move = (e: PointerEvent) => {
          last = e;
          if (raf) return;
          raf = requestAnimationFrame(() => { raf = 0; if (!last) return; const r = sec.getBoundingClientRect(); sec.style.setProperty("--sx", `${last.clientX - r.left}px`); sec.style.setProperty("--sy", `${last.clientY - r.top}px`); });
        };
        sec.addEventListener("pointermove", move, { passive: true });
        cleanups.push(() => sec.removeEventListener("pointermove", move));
      });
    }
    return () => { io.disconnect(); cleanups.forEach((c) => c()); };
  }, []);
  return null;
}
