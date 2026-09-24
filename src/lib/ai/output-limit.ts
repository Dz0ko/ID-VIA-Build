/**
 * Reasoning models count their thinking against the same output limit as the visible answer. A run at
 * xhigh effort spent its whole 32k limit thinking and returned a truncated site, so the request limit is
 * the visible budget plus headroom for thinking, capped at what the model can emit.
 */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const THINKING_HEADROOM: Record<Effort, number> = { low: 4_000, medium: 12_000, high: 32_000, xhigh: 64_000, max: 96_000 };

export function modelMaxOutput(model: string): number {
  if (/haiku/.test(model)) return 64_000;
  if (/gpt-4/.test(model)) return 16_000;
  return 128_000;
}

export function outputTokenLimit(model: string, visible: number, effort: Effort | undefined, reasons: boolean): number {
  const headroom = reasons ? THINKING_HEADROOM[effort ?? "medium"] : 0;
  return Math.max(1, Math.min(modelMaxOutput(model), visible + headroom));
}
