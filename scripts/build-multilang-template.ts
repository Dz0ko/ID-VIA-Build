import { Template } from "e2b";

async function main() {
  const releases = await (await fetch("https://go.dev/dl/?mode=json")).json();
  const go = releases.find((release: { stable: boolean }) => release.stable)?.files.find((file: { os: string; arch: string; kind: string }) => file.os === "linux" && file.arch === "amd64" && file.kind === "archive");
  if (!go || !/^go[\d.]+\.linux-amd64\.tar\.gz$/.test(go.filename) || !/^[a-f0-9]{64}$/.test(go.sha256)) throw new Error("Invalid Go release metadata");
  const gradle = await (await fetch("https://services.gradle.org/versions/current")).json();
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(gradle.version)) throw new Error("Invalid Gradle release metadata");
  const gradleChecksum = (await (await fetch(`https://services.gradle.org/distributions/gradle-${gradle.version}-bin.zip.sha256`)).text()).trim();
  if (!/^[a-f0-9]{64}$/.test(gradleChecksum)) throw new Error("Invalid Gradle checksum");
  const template = Template().fromTemplate("inys70thgko5tow4cn24")
    .runCmd("apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev libicu-dev zlib1g-dev python3-venv python3-dev openjdk-17-jdk-headless maven php-cli php-mbstring php-xml php-curl php-pgsql php-sqlite3 composer ruby ruby-dev ruby-bundler unzip && apt-get clean", { user: "root" })
    .runCmd(`curl -fsSL https://go.dev/dl/${go.filename} -o /tmp/go.tar.gz && echo '${go.sha256}  /tmp/go.tar.gz' | sha256sum -c - && tar -C /opt -xzf /tmp/go.tar.gz && ln -sf /opt/go/bin/go /usr/local/bin/go && ln -sf /opt/go/bin/gofmt /usr/local/bin/gofmt`, { user: "root" })
    .runCmd("curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup.sh && sh /tmp/rustup.sh -y --profile minimal && sudo ln -sf /home/user/.cargo/bin/cargo /usr/local/bin/cargo && sudo ln -sf /home/user/.cargo/bin/rustc /usr/local/bin/rustc")
    .runCmd("curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh && bash /tmp/dotnet-install.sh --channel 10.0 --install-dir /opt/dotnet && bash /tmp/dotnet-install.sh --channel 8.0 --install-dir /opt/dotnet && ln -sf /opt/dotnet/dotnet /usr/local/bin/dotnet && chmod -R a+rX /opt/dotnet", { user: "root" })
    .runCmd("curl -fsSL https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz -o /tmp/node.tar.xz && echo 'fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6  /tmp/node.tar.xz' | sha256sum -c - && tar -xJf /tmp/node.tar.xz -C /opt && ln -sf /opt/node-v24.21.0-linux-x64/bin/node /usr/local/bin/node && ln -sf /opt/node-v24.21.0-linux-x64/bin/npm /usr/local/bin/npm && ln -sf /opt/node-v24.21.0-linux-x64/bin/npx /usr/local/bin/npx", { user: "root" })
    .runCmd("npm install --global corepack@latest && corepack enable", { user: "root" })
    .runCmd(`curl -fsSL https://services.gradle.org/distributions/gradle-${gradle.version}-bin.zip -o /tmp/gradle.zip && echo '${gradleChecksum}  /tmp/gradle.zip' | sha256sum -c - && unzip -q /tmp/gradle.zip -d /opt && ln -sf /opt/gradle-${gradle.version}/bin/gradle /usr/local/bin/gradle`, { user: "root" })
    .setEnvs({ NODE_OPTIONS: "--max-old-space-size=3072", NEXT_TELEMETRY_DISABLED: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_ROOT: "/opt/dotnet", CARGO_BUILD_JOBS: "2", JAVA_TOOL_OPTIONS: "-XX:MaxRAMPercentage=65" });
  const build = await Template.build(template, "idaevia-multilang-v2", { cpuCount: 2, memoryMB: 4096, onBuildLogs: log => {
    if (!log.message.includes("[stdout]")) console.log(log.message);
  } });
  console.log(JSON.stringify({ templateId: build.templateId }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Template build failed"); process.exitCode = 1; });
