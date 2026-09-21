"use client";

import { useEffect } from "react";

/**
 * Imperative landing-page effects: reveal on scroll, 3D tilt on [data-tilt],
 * magnetic buttons on [data-magnetic], cursor spotlight on [data-spotlight].
 */
export function LandingFx() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { threshold: 0.12 });
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; io.observe(el); });

    const cleanups: (() => void)[] = [];
    if (!reduced) {
      document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => {
        const max = Number(card.dataset.tilt || 8);
        const move = (e: PointerEvent) => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = `perspective(900px) rotateX(${-py * max}deg) rotateY(${px * max}deg) translateY(-4px)`;
          card.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
          card.style.setProperty("--my", `${(py + 0.5) * 100}%`);
        };
        const leave = () => { card.style.transform = ""; };
        card.addEventListener("pointermove", move); card.addEventListener("pointerleave", leave);
        cleanups.push(() => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", leave); });
      });
      document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((btn) => {
        const move = (e: PointerEvent) => {
          const r = btn.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.18}px)`;
        };
        const leave = () => { btn.style.transform = ""; };
        btn.addEventListener("pointermove", move); btn.addEventListener("pointerleave", leave);
        cleanups.push(() => { btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerleave", leave); });
      });
      document.querySelectorAll<HTMLElement>("[data-spotlight]").forEach((sec) => {
        const move = (e: PointerEvent) => { const r = sec.getBoundingClientRect(); sec.style.setProperty("--sx", `${e.clientX - r.left}px`); sec.style.setProperty("--sy", `${e.clientY - r.top}px`); };
        sec.addEventListener("pointermove", move);
        cleanups.push(() => sec.removeEventListener("pointermove", move));
      });
    }
    return () => { io.disconnect(); cleanups.forEach((c) => c()); };
  }, []);
  return null;
}
