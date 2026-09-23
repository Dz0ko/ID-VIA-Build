/** Per-project VM budgets. Heavy app builds never share the small static-site runtime. */
export function runtimeResources(kind: string) {
  return kind === "app"
    ? { template: process.env.E2B_MULTILANG_TEMPLATE || "sbqu30ygh8vpv2s6b4ve", memoryMB: 4096 }
    : { template: process.env.E2B_RUNTIME_TEMPLATE || "inys70thgko5tow4cn24", memoryMB: 2048 };
}
export function runtimeMemoryEnvironment(memoryMB: number) {
  return {
    NODE_OPTIONS: `--max-old-space-size=${Math.floor(memoryMB * 0.75)}`,
    JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=65",
    CARGO_BUILD_JOBS: "2",
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  };
}
