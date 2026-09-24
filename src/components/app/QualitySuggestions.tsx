"use client";
type Choice = { id: "high" | "xhigh"; label: string; credits: number; minutes: string; detail: string; recommended: boolean };

export function QualitySuggestions({ choices, disabled, onChoose }: { choices: Choice[]; disabled: boolean; onChoose: (id: Choice["id"]) => void }) {
  return <section aria-label="Choose the quality mode" className="rounded-2xl border border-graphite p-4 space-y-3">
    <p className="text-xs text-ash">How deeply should the agents work on this project? Saved per project; change it any time by writing “best quality” or “balanced quality”.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map(choice => <button key={choice.id} type="button" disabled={disabled} onClick={() => onChoose(choice.id)} className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${choice.recommended ? "border-signal/40 bg-signal/10 hover:bg-signal/20" : "border-graphite hover:border-signal/50 hover:bg-signal/10"}`}>
        <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-paper">{choice.label}</span>{choice.recommended && <span className="pill text-[10px] text-signal-soft border-signal/40">Recommended</span>}</span>
        <span className="mt-2 block text-sm text-fog">≈ {choice.credits.toLocaleString()} credits · {choice.minutes}</span>
        <span className="mt-2 block text-xs text-ash">{choice.detail}</span>
      </button>)}
    </div>
    <p className="text-xs text-ash">The difference is reasoning time before writing: more planning and more self-checks cost more tokens, so the same page costs more credits.</p>
  </section>;
}
