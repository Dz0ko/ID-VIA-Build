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
  | "overview" | "users" | "payments" | "payouts" | "affiliates" | "bell" | "home" | "plus" | "search" | "arrow"
  | "describe" | "build" | "audit" | "share" | "launch"
  | "alert" | "arrowLeft" | "arrowRight" | "check" | "checkCircle" | "clock" | "copy" | "download" | "external" | "eye"
  | "archive" | "filePlus" | "folderPlus" | "gift" | "branch" | "globe" | "image" | "bulb" | "link" | "expand" | "menu"
  | "message" | "monitor" | "palette" | "pencil" | "send" | "bag" | "trash" | "upload" | "wallet" | "close"
  | "planner" | "designer" | "copywriter" | "debugger" | "seo" | "ui" | "ux" | "animation" | "3d" | "asset" | "localization"
  | "performance" | "accessibility" | "security" | "qa" | "refactoring" | "dependency" | "database" | "api" | "auth" | "analytics" | "conversion" | "documentation" | "pm"
  | "tablet" | "smartphone" | "history" | "terminal" | "warning" | "play" | "rotate" | "save" | "file" | "folder" | "chevronRight";

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
  /* Landing steps */
  describe: (<><path d="M5 5.5h14" /><path d="M5 10h9" /><path d="M5 14.5h11" /><path d="M5 19h6" /><circle cx="18.5" cy="14.5" r="1.4" fill={DOT} stroke="none" /></>),
  build: (<><path d="M4.5 7.5l7.5-4 7.5 4v9l-7.5 4-7.5-4z" /><path d="M4.5 7.5l7.5 4 7.5-4M12 11.5v9" /><circle cx="12" cy="11.5" r="1.4" fill={DOT} stroke="none" /></>),
  audit: (<><path d="M12 3.5l7 2.5v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z" /><path d="M9 12l2 2 4-4" /><circle cx="15" cy="10" r="1.4" fill={DOT} stroke="none" /></>),
  share: (<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /><circle cx="18" cy="6" r="1.2" fill={DOT} stroke="none" /></>),
  launch: (<><path d="M12 3.5c3 2.5 4.5 6 4.5 10L12 16l-4.5-2.5c0-4 1.5-7.5 4.5-10z" /><path d="M7.5 13.5L5 16.5l3 1" /><path d="M16.5 13.5l2.5 3-3 1" /><path d="M10.5 19l1.5 2 1.5-2" /><circle cx="12" cy="9.5" r="1.4" fill={DOT} stroke="none" /></>),
  /* Generic UI */
  alert: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5" /><circle cx="12" cy="16" r="1.2" fill={DOT} stroke="none" /></>),
  arrowLeft: (<><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /><circle cx="5" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  arrowRight: (<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /><circle cx="19" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  check: (<><path d="M5 12.5l4.5 4.5L19 7.5" /><circle cx="9.5" cy="17" r="1.4" fill={DOT} stroke="none" /></>),
  checkCircle: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /><circle cx="11" cy="15" r="1.2" fill={DOT} stroke="none" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M6 15H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 4h8A1.5 1.5 0 0 1 14.5 5.5V6" /><circle cx="14.5" cy="14.5" r="1.4" fill={DOT} stroke="none" /></>),
  download: (<><path d="M12 3.5v11" /><path d="M8 10.5l4 4 4-4" /><path d="M4.5 15.5v2a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-2" /><circle cx="12" cy="14.5" r="1.4" fill={DOT} stroke="none" /></>),
  external: (<><path d="M14 4.5h5.5V10" /><path d="M19.5 4.5L11 13" /><path d="M18 14v3.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10" /><circle cx="19.5" cy="4.5" r="1.4" fill={DOT} stroke="none" /></>),
  eye: (<><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="1.3" fill={DOT} stroke="none" /></>),
  archive: (<><rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" /><path d="M5 9v8.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /><circle cx="17" cy="6.75" r="1.2" fill={DOT} stroke="none" /></>),
  filePlus: (<><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13.5 3.5V9H19" /><path d="M12 12v5M9.5 14.5h5" /><circle cx="12" cy="14.5" r="1.2" fill={DOT} stroke="none" /></>),
  folderPlus: (<><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M12 11v5M9.5 13.5h5" /><circle cx="12" cy="13.5" r="1.2" fill={DOT} stroke="none" /></>),
  gift: (<><rect x="3.5" y="9" width="17" height="4" rx="1" /><path d="M5 13v6.5h14V13" /><path d="M12 9v10.5" /><path d="M12 9c-1.5-3.5-5-3.5-5-1.5S10 9 12 9zm0 0c1.5-3.5 5-3.5 5-1.5S14 9 12 9z" /><circle cx="12" cy="9" r="1.3" fill={DOT} stroke="none" /></>),
  branch: (<><circle cx="6" cy="5.5" r="2" /><circle cx="6" cy="18.5" r="2" /><circle cx="18" cy="8.5" r="2" /><path d="M6 7.5v9" /><path d="M18 10.5c0 3.5-3 4.5-6 5-2.5.4-4.5 1-6 1" /><circle cx="18" cy="8.5" r="1.1" fill={DOT} stroke="none" /></>),
  globe: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" /><circle cx="12" cy="12" r="1.3" fill={DOT} stroke="none" /></>),
  image: (<><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 16l4.5-4.5 4 4 2.5-2.5 6 6" /><circle cx="15.5" cy="9.5" r="1.4" fill={DOT} stroke="none" /></>),
  bulb: (<><path d="M9 18.5h6M10 21h4" /><path d="M8 13.5A5.5 5.5 0 1 1 16 13.5c-.8.8-1.5 1.7-1.5 3H9.5c0-1.3-.7-2.2-1.5-3z" /><circle cx="12" cy="10" r="1.4" fill={DOT} stroke="none" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 0 0 5.7 5.7l1-1" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  expand: (<><path d="M14 4.5h5.5V10M10 19.5H4.5V14" /><path d="M19.5 4.5L14 10M4.5 19.5L10 14" /><circle cx="19.5" cy="4.5" r="1.3" fill={DOT} stroke="none" /></>),
  menu: (<><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="20" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  message: (<><path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4.5 3.5v-3.5h-1z" /><circle cx="15.5" cy="10.5" r="1.3" fill={DOT} stroke="none" /></>),
  monitor: (<><rect x="3.5" y="4.5" width="17" height="11.5" rx="2" /><path d="M9 20h6M12 16v4" /><circle cx="12" cy="10" r="1.4" fill={DOT} stroke="none" /></>),
  palette: (<><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 1.5-2s-.5-2 1-2H16a4.5 4.5 0 0 0 4.5-4.5C20.5 7 16.7 3.5 12 3.5z" /><circle cx="8" cy="11" r="1" /><circle cx="11" cy="7.5" r="1" /><circle cx="15.5" cy="8.5" r="1" /><circle cx="8" cy="15" r="1.4" fill={DOT} stroke="none" /></>),
  pencil: (<><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M13.5 7.5l3 3" /><circle cx="17.5" cy="6.5" r="1.4" fill={DOT} stroke="none" /></>),
  send: (<><path d="M4 11.5L20 4l-4.5 16-4-7z" /><path d="M11.5 13L20 4" /><circle cx="20" cy="4" r="1.4" fill={DOT} stroke="none" /></>),
  bag: (<><path d="M5.5 8.5h13l-1 11h-11z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /><circle cx="12" cy="14" r="1.4" fill={DOT} stroke="none" /></>),
  trash: (<><path d="M4.5 7h15" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" /><path d="M10 11v5M14 11v5" /><circle cx="19.5" cy="7" r="1.2" fill={DOT} stroke="none" /></>),
  upload: (<><path d="M12 14.5v-11" /><path d="M8 7.5l4-4 4 4" /><path d="M4.5 15.5v2a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-2" /><circle cx="12" cy="3.5" r="1.4" fill={DOT} stroke="none" /></>),
  wallet: (<><path d="M4 7.5A2 2 0 0 1 6 5.5h11.5v3" /><rect x="4" y="8.5" width="16.5" height="11" rx="2" /><path d="M15.5 14h5" /><circle cx="15.5" cy="14" r="1.4" fill={DOT} stroke="none" /></>),
  close: (<><path d="M6 6l12 12M18 6L6 18" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  /* Agents */
  planner: (<><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8 3.5v3M16 3.5v3" /><circle cx="9" cy="15" r="1.4" fill={DOT} stroke="none" /></>),
  designer: (<><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 1.5-2s-.5-2 1-2H16a4.5 4.5 0 0 0 4.5-4.5C20.5 7 16.7 3.5 12 3.5z" /><circle cx="8" cy="11" r="1" /><circle cx="11" cy="7.5" r="1" /><circle cx="15.5" cy="8.5" r="1" /><circle cx="8" cy="15" r="1.4" fill={DOT} stroke="none" /></>),
  copywriter: (<><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M13.5 7.5l3 3" /><circle cx="17.5" cy="6.5" r="1.4" fill={DOT} stroke="none" /></>),
  debugger: (<><path d="M9 8a3 3 0 0 1 6 0v1H9z" /><rect x="7" y="9" width="10" height="10" rx="4" /><path d="M4 13h3M17 13h3M5 18l2.5-2M19 18l-2.5-2M5.5 8.5L8 10M18.5 8.5L16 10" /><circle cx="12" cy="14" r="1.4" fill={DOT} stroke="none" /></>),
  seo: (<><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /><path d="M8 12l2-2.5 2 1.5 2-3" /><circle cx="20" cy="20" r="1.4" fill={DOT} stroke="none" /></>),
  ui: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M9.5 9.5v10" /><circle cx="6.5" cy="7" r="1.4" fill={DOT} stroke="none" /></>),
  ux: (<><path d="M4 16c3-6 5-8 8-8s5 2 8 8" /><circle cx="12" cy="8" r="1.4" fill={DOT} stroke="none" /><path d="M4 16h16" /></>),
  animation: (<><path d="M4 20l9.5-9.5" /><path d="M13.5 10.5l2.5 2.5" /><path d="M16.5 4.5v3M15 6h3M20 10.5v2M19 11.5h2M8 3.5v2M7 4.5h2" /><circle cx="15.5" cy="8.5" r="1.4" fill={DOT} stroke="none" /></>),
  "3d": (<><path d="M4.5 7.5l7.5-4 7.5 4v9l-7.5 4-7.5-4z" /><path d="M4.5 7.5l7.5 4 7.5-4M12 11.5v9" /><circle cx="12" cy="11.5" r="1.4" fill={DOT} stroke="none" /></>),
  asset: (<><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 16l4.5-4.5 4 4 2.5-2.5 6 6" /><circle cx="15.5" cy="9.5" r="1.4" fill={DOT} stroke="none" /></>),
  localization: (<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" /><circle cx="12" cy="12" r="1.3" fill={DOT} stroke="none" /></>),
  performance: (<><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1.4" fill={DOT} stroke="none" /></>),
  accessibility: (<><circle cx="12" cy="5.5" r="1.8" /><path d="M5 9.5c4.5 1 9.5 1 14 0M12 10.5v5l-3 5M12 15.5l3 5" /><circle cx="12" cy="5.5" r="1.1" fill={DOT} stroke="none" /></>),
  security: (<><path d="M12 3.5l7 2.5v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z" /><rect x="9.5" y="10.5" width="5" height="4" rx="1" /><path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5" /><circle cx="12" cy="12.5" r="1" fill={DOT} stroke="none" /></>),
  qa: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /><circle cx="11" cy="15" r="1.2" fill={DOT} stroke="none" /></>),
  refactoring: (<><path d="M4 7h11a4 4 0 0 1 0 8H9" /><path d="M11 12l-3 3 3 3" /><circle cx="8" cy="15" r="1.4" fill={DOT} stroke="none" /></>),
  dependency: (<><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /><path d="M10 7h4.5a2.5 2.5 0 0 1 2.5 2.5V14" /><circle cx="17" cy="14" r="1.4" fill={DOT} stroke="none" /></>),
  database: (<><ellipse cx="12" cy="6" rx="7.5" ry="2.5" /><path d="M4.5 6v12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6" /><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" /><circle cx="16.5" cy="17" r="1.3" fill={DOT} stroke="none" /></>),
  api: (<><path d="M4 12h5" /><path d="M15 6.5h5M15 12h5M15 17.5h5" /><path d="M9 12c2.5 0 3.5-5.5 6-5.5M9 12c2.5 0 3.5 5.5 6 5.5M9 12h6" /><circle cx="9" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  auth: (<><rect x="5.5" y="10.5" width="13" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><circle cx="12" cy="15.5" r="1.4" fill={DOT} stroke="none" /></>),
  analytics: (<><path d="M4 19.5h16" /><path d="M6.5 16v-5M11 16V7M15.5 16v-3M20 16V5" /><circle cx="20" cy="5" r="1.4" fill={DOT} stroke="none" /></>),
  conversion: (<><path d="M4 5h16l-6 7v6l-4 2v-8z" /><circle cx="12" cy="12" r="1.4" fill={DOT} stroke="none" /></>),
  documentation: (<><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13.5 3.5V9H19M8.5 13h7M8.5 16.5h5" /><circle cx="16" cy="13" r="1.2" fill={DOT} stroke="none" /></>),
  pm: (<><rect x="4" y="4.5" width="16" height="15" rx="2.5" /><path d="M8 9h8M8 12.5h5M8 16h6" /><circle cx="16" cy="16" r="1.3" fill={DOT} stroke="none" /></>),
  tablet: (<><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M10.5 17.5h3" /><circle cx="12" cy="17.5" r="1.1" fill={DOT} stroke="none" /></>),
  smartphone: (<><rect x="7" y="3.5" width="10" height="17" rx="2.5" /><path d="M11 17.5h2" /><circle cx="12" cy="17.5" r="1.1" fill={DOT} stroke="none" /></>),
  history: (<><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4.5v4.5h4.5" /><path d="M12 8v4l2.5 1.5" /><circle cx="12" cy="12" r="1.3" fill={DOT} stroke="none" /></>),
  terminal: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M7.5 9l3 3-3 3M12.5 15h4" /><circle cx="16.5" cy="15" r="1.2" fill={DOT} stroke="none" /></>),
  warning: (<><path d="M12 4l8.5 15h-17z" /><path d="M12 9.5v4" /><circle cx="12" cy="16" r="1.2" fill={DOT} stroke="none" /></>),
  play: (<><path d="M7 5.5l11 6.5-11 6.5z" /><circle cx="18" cy="12" r="1.3" fill={DOT} stroke="none" /></>),
  rotate: (<><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4.5v4.5h4.5" /><circle cx="4" cy="9" r="1.3" fill={DOT} stroke="none" /></>),
  save: (<><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h9L19 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5z" /><path d="M8 4v5h7V4M8 19.5v-5h8v5" /><circle cx="12" cy="17" r="1.2" fill={DOT} stroke="none" /></>),
  file: (<><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13.5 3.5V9H19" /><path d="M9 14l-1.5 1.5L9 17M15 14l1.5 1.5L15 17" /><circle cx="12" cy="15.5" r="1.1" fill={DOT} stroke="none" /></>),
  folder: (<><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><circle cx="17" cy="15.5" r="1.3" fill={DOT} stroke="none" /></>),
  chevronRight: (<><path d="M9.5 6l6 6-6 6" /><circle cx="15.5" cy="12" r="1.2" fill={DOT} stroke="none" /></>),
};

export function BrandIcon({ name, size = 16, strokeWidth = 1.75, ...rest }: { name: BrandIconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {ICONS[name]}
    </svg>
  );
}

/** Icon for a built-in agent id (falls back to the generic agents icon). */
const AGENT_ICONS: Record<string, BrandIconName> = {
  builder: "build", planner: "planner", designer: "designer", copywriter: "copywriter", debugger: "debugger", seo: "seo",
  ui: "ui", ux: "ux", animation: "animation", "3d": "3d", asset: "asset", localization: "localization", "asset-ref": "screenshot", clone: "copy",
  performance: "performance", accessibility: "accessibility", security: "security", qa: "qa", refactoring: "refactoring", dependency: "dependency",
  database: "database", api: "api", auth: "auth", payments: "payments", git: "branch", deploy: "launch", analytics: "analytics", conversion: "conversion", documentation: "documentation", pm: "pm",
};
export const agentIcon = (id: string): BrandIconName => AGENT_ICONS[id] ?? "agents";
