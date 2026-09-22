"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight, Lock } from "@/components/icons";

type Option = { value: string; label: string; description?: string; group?: string; disabled?: boolean };

export function ComposerSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(value);
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => `${o.label} ${o.description ?? ""} ${o.group ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const enabled = filtered.filter((o) => !o.disabled);
  const activeValue = enabled.some((o) => o.value === active) ? active : enabled[0]?.value;

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function choose(option: Option) {
    if (option.disabled) return;
    onChange(option.value);
    close();
  }
  useEffect(() => {
    if (!open) return;
    function position() {
      if (!trigger.current || !popup.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const above = rect.top > window.innerHeight - rect.bottom;
      const height = Math.max(120, (above ? rect.top : window.innerHeight - rect.bottom) - 16);
      Object.assign(popup.current.style, {
        width: `${Math.min(360, window.innerWidth - 24)}px`,
        left: `${Math.max(12, Math.min(rect.left, window.innerWidth - 372))}px`,
        top: above ? "auto" : `${rect.bottom + 8}px`,
        bottom: above ? `${window.innerHeight - rect.top + 8}px` : "auto",
        maxHeight: `${Math.min(400, height)}px`,
      });
    }
    position();
    search.current?.focus({ preventScroll: true });
    function outside(event: PointerEvent) {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    }
    function focusOutside(event: FocusEvent) {
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", focusOutside);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${activeValue}`)?.scrollIntoView({ block: "nearest" });
  }, [activeValue, id, open]);

  return <>
    <button ref={trigger} type="button" aria-label={`${label}: ${selected?.label ?? value}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} className="composer-select-trigger" onClick={() => { setQuery(""); setActive(value); setOpen(!open); }} onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setQuery(""); setActive(value); setOpen(true); } }}>
      <span className="composer-select-dot" /><span className="truncate">{selected?.label ?? value}</span><ChevronRight size={13} className="ml-auto rotate-90 shrink-0 text-ash" />
    </button>
    {open && createPortal(<div ref={popup} id={id} role="dialog" aria-label={`Choose ${label.toLowerCase()}`} className="composer-select-popup" onKeyDown={(e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === "Tab") { close(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const index = enabled.findIndex((o) => o.value === activeValue);
        const next = enabled[(index + (e.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length];
        if (next) setActive(next.value);
      }
      if (e.key === "Enter") { e.preventDefault(); const option = enabled.find((o) => o.value === activeValue); if (option) choose(option); }
    }}>
      <div className="px-3 pt-3 pb-2 border-b border-graphite">
        <div className="text-[10px] uppercase tracking-[0.14em] text-signal-soft mb-2">{label === "Agent" ? "Your AI team" : "Model & routing"}</div>
        <input ref={search} role="combobox" aria-label={`Search ${label.toLowerCase()}`} aria-expanded aria-controls={`${id}-options`} aria-autocomplete="list" aria-activedescendant={activeValue ? `${id}-${activeValue}` : undefined} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={label === "Agent" ? "Find an agent…" : "Find a model…"} className="composer-select-search" />
      </div>
      <div id={`${id}-options`} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto p-1.5">
        {filtered.map((option, index) => <div key={option.value}>
          {option.group && option.group !== filtered[index - 1]?.group && <div className="px-2.5 pt-3 pb-1.5 text-[10px] uppercase tracking-wider text-ash">{option.group}</div>}
          <div id={`${id}-${option.value}`} role="option" aria-selected={value === option.value} aria-disabled={option.disabled || undefined} data-active={activeValue === option.value} className="composer-select-option" onMouseEnter={() => { if (!option.disabled) setActive(option.value); }} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(option)}>
            <div className="min-w-0 flex-1"><div className="text-xs font-medium">{option.label}</div>{option.description && <div className="text-[11px] text-ash mt-0.5 leading-relaxed">{option.description}</div>}</div>
            {option.disabled ? <Lock size={12} className="text-ash shrink-0" /> : value === option.value ? <CheckCircle2 size={14} className="text-signal-soft shrink-0" /> : null}
          </div>
        </div>)}
        {!filtered.length && <p className="p-4 text-xs text-ash">No results. Try another search.</p>}
      </div>
    </div>, document.body)}
  </>;
}
