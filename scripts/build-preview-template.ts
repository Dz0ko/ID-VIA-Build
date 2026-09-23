import { Template } from "e2b";

async function main() {
// A reusable image, never containing customer source or credentials.
const template = Template().fromTemplate("base")
  .runCmd("apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql postgresql-client && apt-get clean", { user: "root" })
  .setEnvs({ NODE_OPTIONS: "--max-old-space-size=1536", NEXT_TELEMETRY_DISABLED: "1" });
const build = await Template.build(template, "idaevia-preview-v1", {
  cpuCount: 2, memoryMB: 2048,
  onBuildLogs: log => console.log(log.message),
});
console.log(JSON.stringify({ templateId: build.templateId }));

}
main().catch(error => { console.error(error instanceof Error ? error.message : "Template build failed"); process.exitCode = 1; });
