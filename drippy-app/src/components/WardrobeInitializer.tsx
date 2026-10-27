"use client";

import { useEffect } from "react";
import { clearWardrobeAndPlannerData } from "@/lib/db";

export default function WardrobeInitializer() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const PURGE_KEY = "drippy_inventory_purged_v1";
    if (!localStorage.getItem(PURGE_KEY)) {
      clearWardrobeAndPlannerData().then(() => {
        localStorage.setItem(PURGE_KEY, "true");
      });
    }
  }, []);

  return null;
}
