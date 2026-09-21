"use client";

import { useMemo } from "react";
import { SandpackProvider, SandpackPreview, SandpackLayout } from "@codesandbox/sandpack-react";

// Entry point: injects Tailwind's runtime (CDN) before mounting so utility classes work inside the sandbox iframe.
const INDEX_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const tw = document.createElement("script");
tw.src = "https://cdn.tailwindcss.com";
document.head.appendChild(tw);
const base = document.createElement("style");
base.textContent = "html,body,#root{height:100%;margin:0} body{font-family:Inter,system-ui,sans-serif}";
document.head.appendChild(base);

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
`;

/** Live in-browser sandbox for multi-file React + TS projects (bundled client-side, isolated iframe). */
export function AppSandbox({ files }: { files: { path: string; content: string }[] }) {
  const sandboxFiles = useMemo(() => {
    const map: Record<string, string> = { "/index.tsx": INDEX_TSX };
    for (const f of files) if (f.path !== "/index.tsx") map[f.path] = f.content;
    return map;
  }, [files]);

  return (
    <SandpackProvider
      template="react-ts"
      theme="dark"
      files={sandboxFiles}
      customSetup={{
        dependencies: {
          "lucide-react": "0.460.0",
          recharts: "2.12.7",
          "framer-motion": "11.11.0",
          clsx: "2.1.1",
          zustand: "5.0.0",
          "date-fns": "4.1.0",
        },
      }}
      options={{ recompileMode: "delayed", recompileDelay: 600 }}
    >
      <SandpackLayout style={{ height: "100%", border: 0, borderRadius: 0 }}>
        <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ height: "100%" }} />
      </SandpackLayout>
    </SandpackProvider>
  );
}
