export const CREDIT_NOTICE_EVENT = "idaevia:credits-required";
export function notifyCreditShortfall(detail: { have?: number; needed?: number }) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CREDIT_NOTICE_EVENT, { detail }));
}
