"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Whop business id (public identifier used by the Whop analytics pixel). */
const WHOP_PIXEL_SCOPE = "biz_Yos5xtZk4FISCH";
const WHOP_PIXEL_HOST = "https://t.whop.tw";

declare global {
  interface Window {
    whop?: { track: (...args: unknown[]) => void; setScope: (...scopes: string[]) => void };
  }
}

/** Track a custom event in Whop analytics (no-op when the pixel is not loaded). */
export function whopTrack(event: string, props?: Record<string, unknown>) {
  try {
    window.whop?.track(event, props ?? {});
  } catch {
    /* ignore */
  }
}

/**
 * Whop analytics pixel: page views on every route change plus conversion events
 * (signup, checkout start) so the Whop dashboard shows the full funnel.
 */
export function WhopPixel() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/api") || pathname.startsWith("/s/")) return;
    const t = setTimeout(() => whopTrack("page", { path: pathname }), 0);
    return () => clearTimeout(t);
  }, [pathname]);
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <Script id="whop-pixel" strategy="afterInteractive">{`
!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script",${JSON.stringify(WHOP_PIXEL_HOST)},"whop");
whop.setScope(${JSON.stringify(WHOP_PIXEL_SCOPE)});
whop.track("page");
    `}</Script>
  );
}
