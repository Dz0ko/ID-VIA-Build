"use client";

import { useEffect } from "react";
import { whopTrack } from "@/components/WhopPixel";

/** Fires one Whop analytics event when mounted (e.g. after returning from checkout). */
export function TrackEvent({ event, props }: { event: string; props?: Record<string, unknown> }) {
  useEffect(() => {
    const t = setTimeout(() => whopTrack(event, props), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
