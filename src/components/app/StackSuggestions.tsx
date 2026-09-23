import { recommendedProjectStack, STACK_CHOICES } from "@/lib/project-stack";

export function StackSuggestions({ request, kind, disabled, onChoose, onCustom }: {
  request: string; kind: string; disabled: boolean;
  onChoose: (stack: string) => void; onCustom: () => void;
}) {
  const recommended = recommendedProjectStack(request, kind);
  return <section aria-label="Choose your project stack" className="rounded-2xl border border-graphite p-4 space-y-4">
    <button type="button" disabled={disabled} onClick={() => onChoose(recommended.label)} className="w-full rounded-xl border border-signal/40 bg-signal/10 p-4 text-left transition-colors hover:bg-signal/20 disabled:opacity-50">
      <span className="block text-xs font-medium text-signal-soft mb-2">Recommended · click to build</span>
      <span className="block text-sm font-semibold text-paper">{recommended.label}</span>
      <span className="block text-xs text-ash mt-1">{recommended.description}</span>
    </button>
    <details>
      <summary className="cursor-pointer text-sm text-fog">Choose another language or framework</summary>
      <div className="grid gap-2 sm:grid-cols-2 mt-3">
        {STACK_CHOICES.filter(choice => choice.label !== recommended.label).map(choice => <button key={choice.id} type="button" disabled={disabled} onClick={() => onChoose(choice.label)} className="rounded-xl border border-graphite p-3 text-left transition-colors hover:border-signal/50 hover:bg-signal/10 disabled:opacity-50">
          <span className="block text-sm text-paper">{choice.label}</span>
          <span className="block text-xs text-ash mt-1">{choice.description}</span>
        </button>)}
      </div>
    </details>
    <button type="button" disabled={disabled} onClick={onCustom} className="btn btn-ghost btn-sm">Enter a custom stack</button>
  </section>;
}
