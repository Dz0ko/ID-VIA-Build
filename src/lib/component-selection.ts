import { COMPONENT_EXAMPLES } from "./component-examples";
import { COMPONENTS } from "./library";
export const SELECTABLE_COMPONENTS = [...COMPONENT_EXAMPLES, ...COMPONENTS];
export const MAX_COMPONENT_SELECTION = 3;
export function selectedComponents(request: string) {
  return [...new Set([...request.matchAll(/\[COMPONENT:([a-z0-9-]+)\]/g)].map(m => m[1]))].filter(id => SELECTABLE_COMPONENTS.some(c => c.id === id)).slice(0, MAX_COMPONENT_SELECTION);
}
export function componentImplementationPrompt(request: string, ids: string[]) {
  const items = [...new Set(ids)].map(id => SELECTABLE_COMPONENTS.find(c => c.id === id)).filter(c => c !== undefined).slice(0, MAX_COMPONENT_SELECTION);
  if (!items.length) return request;
  return `Implement the selected components in this project: ${items.map(c => c.name).join(", ")}.\nAdapt them to the existing website or SaaS stack, styling and layout. Preserve existing content and functionality. Include responsive behavior, keyboard accessibility and reduced-motion support.\n${items.map(c => `[COMPONENT:${c.id}] ${c.prompt.replace(/\s*\[COMPONENT:[a-z0-9-]+\]/g, "")}`).join("\n")}\n${request.trim() ? `\nAdditional instructions:\n${request.trim()}` : ""}`;
}
