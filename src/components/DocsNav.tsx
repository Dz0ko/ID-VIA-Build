"use client";

import { useEffect, useState } from "react";

/** Sidebar navigation for /docs: highlights the section currently on screen in the brand colour. */
export function DocsNav({ items }: { items: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState(items[0]?.[0] ?? "");
  useEffect(() => {
    const headings = items.map(([id]) => document.getElementById(id)).filter((h): h is HTMLElement => !!h);
    if (!headings.length) return;
    const pick = () => {
      const line = 140; // just under the sticky header
      let current = headings[0].id;
      for (const h of headings) { if (h.getBoundingClientRect().top <= line) current = h.id; else break; }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = headings[headings.length - 1].id;
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => { window.removeEventListener("scroll", pick); window.removeEventListener("resize", pick); };
  }, [items]);
  return (
    <nav aria-label="Documentation" className="mt-3 flex lg:flex-col gap-1 overflow-x-auto text-sm lg:border-l lg:border-graphite">
      {items.map(([id, label], i) => {
        const on = id === active;
        return (
          <a key={id} href={`#${id}`} aria-current={on ? "location" : undefined}
            className={`relative whitespace-nowrap px-3 py-1.5 rounded-lg lg:rounded-none lg:rounded-r-lg transition-colors ${on ? "text-signal-soft bg-signal/10 font-medium" : "text-fog hover:text-paper hover:bg-ink"}`}>
            <span className={`hidden lg:block absolute left-[-1px] top-1 bottom-1 w-[2px] rounded-full transition-opacity ${on ? "bg-signal opacity-100" : "opacity-0"}`} />
            <span className={`mr-2 font-mono text-[11px] ${on ? "text-signal-soft" : "text-ash"}`}>{String(i + 1).padStart(2, "0")}</span>{label}
          </a>
        );
      })}
    </nav>
  );
}
