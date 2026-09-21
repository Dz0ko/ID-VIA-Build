import type { SVGProps } from "react";

/**
 * IDÆVIA icon set. One visual language for the whole product:
 * 1.75px rounded strokes in the current text colour, geometric shapes on a
 * 24px grid, and the brand's "lit node": a small Signal dot that marks the
 * point of action on every icon (the same dot that sits on the Æ monogram).
 */
export type BrandIconName =
  | "dashboard" | "projects" | "agent" | "import" | "templates" | "prompts" | "components" | "effects" | "agents"
  | "marketplace" | "deployments" | "teams" | "learn" | "settings" | "logout" | "admin" | "lock" | "credits" | "profile"
  | "router" | "library" | "screenshot" | "code" | "versions"
  | "overview" | "users" | "payments" | "payouts" | "affiliates" | "bell" | "home" | "plus" | "search" | "arrow";

const DOT = "var(--signal, #5b5cff)";

/* Each icon: strokes drawn with currentColor, one Signal dot (filled, no stroke). */
const ICONS: Record<BrandIconName, React.ReactNode> = {
  dashboard: (<><rect x="3.5" y="3.5" width="7" height="9" rx="2" /><rect x="13.5" y="3.5" width="7" height="5" rx="2" /><rect x="13.5" y="11.5" width="7" height="9" rx="2" /><rect x="3.5" y="15.5" width="7" height="5" rx="2" /><circle cx="17" cy="6" r="1.4" fill={DOT} stroke="none" /></>),
  projects: (<><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M3.5 11h17" /><circle cx="17" cy="15.5" r="1.4" fill={DOT} stroke="none" /></>),
  agent: (<><path d="M12 3.5c.6 4.5 3.5 7.4 8 8-4.5.6-7.4 3.5-8 8-.6-4.5-3.5-7.4-8-8 4.5-.6 7.4-3.5 8-8z" /><circle cx="18.5" cy="5.5" r="1.4" fill={DOT} stroke="none" /></>),
  import: (<><path d="M12 3.5v11" /><path d="M8 10.5l4 4 4-4" /><path d="M4.5 15.5v2a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-2" /><circle cx="12" cy="14.5" r="1.4" fill={DOT} stroke="none" /></>),
  templates: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M9.5 9.5v10" /><circle cx="6.5" cy="7" r="1.4" fill={DOT} stroke="none" /></>),
  prompts: (<><path d="M5 5.5h14" /><path d="M5 10h9" /><path d="M5 14.5h11" /><path d="M5 19h6" /><circle cx="18.5" cy="14.5" r="1.4" fill={DOT} stroke="none" /></>),
  components: (<><rect x="3.5" y="12.5" width="8" height="8" rx="2" /><rect x="12.5" y="12.5" width="8" height="8" rx="2" /><rect x="8" y="3.5" width="8" height="8" rx="2" /><circle cx="12" cy="7.5" r="1.4" fill={DOT} stroke="none" /></>),
  effects: (<><path d="M4 20l9.5-9.5" /><path d="M13.5 10.5l2.5 2.5" /><path d="M16.5 4.5v3M15 6h3" /><path d="M20 10.5v2M19 11.5h2" /><path d="M8 3.5v2M7 4.5h2" /><circle cx="15.5" cy="8.5" r="1.4" fill={DOT} stroke="none" /></>),
  agents: (<><rect x="4.5" y="8.5" width="15" height="11" rx="3" /><path d="M9 13h.01M15 13h.01" strokeWidth="2.5" /><path d="M9.5 16.5h5" /><path d="M12 8.5v-3" /><circle cx="12" cy="4.5" r="1.4" fill={DOT} stroke="none" /></>),
  marketplace: (<><path d="M4 9.5l1.2-4.5h13.6L20 9.5" /><path d="M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5c0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5" /><path d="M5.5 12v7.5h13V12" /><path d="M10 19.5v-5h4v5" /><circle cx="12" cy="9.5" r="1.4" fill={DOT} stroke="none" /></>),
  deployments: (<><path d="M12 3.5c3 2.5 4.5 6 4.5 10L12 16l-4.5-2.5c0-4 1.5-7.5 4.5-10z" /><path d="M7.5 13.5L5 16.5l3 1" /><path d="M16.5 13.5l2.5 3-3 1" /><path d="M10.5 19l1.5 2 1.5-2" /><circle cx="12" cy="9.5" r="1.4" fill={DOT} stroke="none" /></>),
  teams: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M15.5 5.5a3 3 0 0 1 0 5.5" /><path d="M17 14.5c2.2.5 3.5 2.3 3.5 5" /><circle cx="18" cy="8" r="1.4" fill={DOT} stroke="none" /></>),
  learn: (<><path d="M3.5 9.5L12 5.5l8.5 4-8.5 4z" /><path d="M7 11.5v4.5c0 1.5 2.2 2.5 5 2.5s5-1 5-2.5v-4.5" /><path d="M20.5 9.5v5" /><circle cx="20.5" cy="16" r="1.4" fill={DOT} stroke="none" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  logout: (<><path d="M10 4.5H7a2.5 2.5 0 0 0-2.5 2.5v10A2.5 2.5 0 0 0 7 19.5h3" /><path d="M14 8l4 4-4 4" /><path d="M9 12h9" /><circle cx="18" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  admin: (<><path d="M12 3.5l7 2.5v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z" /><path d="M9 12l2 2 4-4" /><circle cx="12" cy="6.5" r="1.4" fill={DOT} stroke="none" /></>),
  lock: (<><rect x="5.5" y="10.5" width="13" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><circle cx="12" cy="15.5" r="1.4" fill={DOT} stroke="none" /></>),
  credits: (<><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10h17" /><path d="M7 14.5h4" /><circle cx="17" cy="14.5" r="1.4" fill={DOT} stroke="none" /></>),
  profile: (<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.7 3.4-6 7-6s6.4 2.3 7 6" /><circle cx="15.5" cy="6" r="1.4" fill={DOT} stroke="none" /></>),
  router: (<><path d="M4 12h5" /><path d="M15 6.5h5M15 12h5M15 17.5h5" /><path d="M9 12c2.5 0 3.5-5.5 6-5.5M9 12c2.5 0 3.5 5.5 6 5.5M9 12h6" /><circle cx="9" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  library: (<><rect x="3.5" y="4.5" width="5" height="15" rx="1.5" /><rect x="10.5" y="4.5" width="5" height="15" rx="1.5" /><path d="M17 5.5l3.5 13.5" /><circle cx="6" cy="8" r="1.4" fill={DOT} stroke="none" /></>),
  screenshot: (<><path d="M4.5 8.5a2 2 0 0 1 2-2H9l1.5-2h3l1.5 2h2.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.2" /><circle cx="12" cy="13" r="1.4" fill={DOT} stroke="none" /></>),
  code: (<><path d="M8 8l-4 4 4 4" /><path d="M16 8l4 4-4 4" /><path d="M13.5 5.5l-3 13" /><circle cx="4" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  versions: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  overview: (<><path d="M4 19.5h16" /><path d="M6.5 16v-5M11 16V7M15.5 16v-3M20 16V5" /><circle cx="20" cy="5" r="1.4" fill={DOT} stroke="none" /></>),
  users: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M15.5 5.5a3 3 0 0 1 0 5.5" /><path d="M17 14.5c2.2.5 3.5 2.3 3.5 5" /><circle cx="18" cy="8" r="1.4" fill={DOT} stroke="none" /></>),
  payments: (<><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10h17" /><path d="M7 14.5h4" /><circle cx="17" cy="14.5" r="1.4" fill={DOT} stroke="none" /></>),
  payouts: (<><rect x="3.5" y="7" width="17" height="10" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M7 12h.01M17 12h.01" strokeWidth="2.5" /><path d="M6 20h12" /><circle cx="12" cy="12" r="1.2" fill={DOT} stroke="none" /></>),
  affiliates: (<><path d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 0 0 5.7 5.7l1-1" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  bell: (<><path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z" /><path d="M10 20.5a2 2 0 0 0 4 0" /><circle cx="17" cy="6" r="1.4" fill={DOT} stroke="none" /></>),
  home: (<><path d="M4 11l8-6.5 8 6.5v8a1.5 1.5 0 0 1-1.5 1.5H14v-5h-4v5H5.5A1.5 1.5 0 0 1 4 19z" /><circle cx="12" cy="9.5" r="1.4" fill={DOT} stroke="none" /></>),
  plus: (<><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  search: (<><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /><circle cx="20" cy="20" r="1.4" fill={DOT} stroke="none" /></>),
  arrow: (<><path d="M7 17L17 7" /><path d="M9 7h8v8" /><circle cx="17" cy="7" r="1.4" fill={DOT} stroke="none" /></>),
};

export function BrandIcon({ name, size = 16, strokeWidth = 1.75, ...rest }: { name: BrandIconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {ICONS[name]}
    </svg>
  );
}
