/** `origin` says whose problem a failure is: the project's code or configuration, or the platform's build environment. */
export type RuntimeReport = { status: "running" | "success" | "error"; label: string; log: string; startedAt: string; finishedAt?: string; fingerprint: string; current?: boolean; origin?: "project" | "platform" };
export function redactRuntimeLog(text: string, values: string[] = []) {
  let clean = text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+/gi, "[database URL]")
    .replace(/((?:[A-Z_]*(?:SECRET|TOKEN|PASSWORD|API_KEY)[A-Z_]*)\s*[=:]\s*)[^\s"']+/g, "$1[redacted]");
  for (const value of values) if (value.length >= 4) clean = clean.replaceAll(value, "[redacted]");
  return clean;
}
