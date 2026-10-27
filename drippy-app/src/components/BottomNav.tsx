"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt, Sparkles, Calendar, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavTabId = "closet" | "style" | "planner" | "settings";

interface NavItem {
  id: NavTabId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "closet",
    label: "Closet",
    href: "/",
    icon: Shirt,
  },
  {
    id: "style",
    label: "Style",
    href: "/style",
    icon: Sparkles,
  },
  {
    id: "planner",
    label: "Planner",
    href: "/planner",
    icon: Calendar,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: SlidersHorizontal,
  },
];

interface BottomNavProps {
  currentTab?: NavTabId;
  onTabChange?: (tab: NavTabId) => void;
}

export default function BottomNav({ currentTab, onTabChange }: BottomNavProps) {
  const pathname = usePathname();

  // Determine active tab reactively based on current Next.js route
  const getActiveTab = (): NavTabId => {
    if (currentTab) return currentTab;
    if (pathname.startsWith("/style")) return "style";
    if (pathname.startsWith("/planner")) return "planner";
    if (pathname.startsWith("/settings")) return "settings";
    return "closet";
  };

  const activeId = getActiveTab();

  const handleTabClick = (tabId: NavTabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 pointer-events-auto"
    >
      <div className="bg-[#F9F8F6]/92 backdrop-blur-xl border-t border-[#EAE7E1] px-4 pt-2.5 pb-5">
        <ul className="flex items-center justify-around list-none p-0 m-0">
          {NAV_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeId === item.id;

            return (
              <li key={item.id} className="flex-1 text-center">
                <Link
                  href={item.href}
                  onClick={() => handleTabClick(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center py-1 transition-all duration-200 select-none group active:scale-95",
                    isActive
                      ? "text-[#1A1A1A]"
                      : "text-[#8C887B] hover:text-[#1A1A1A]"
                  )}
                >
                  <div
                    className={cn(
                      "relative p-1.5 rounded-full transition-all duration-200",
                      isActive
                        ? "bg-[#2D3A2F]/10 text-[#2D3A2F]"
                        : "group-hover:bg-[#EAE7E1]/50 text-[#8C887B]"
                    )}
                  >
                    <IconComponent
                      size={20}
                      strokeWidth={isActive ? 2.3 : 1.75}
                      className="transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] tracking-wider uppercase mt-1 transition-all",
                      isActive
                        ? "font-semibold text-[#1A1A1A]"
                        : "font-medium text-[#8C887B]"
                    )}
                  >
                    {item.label}
                  </span>

                  {/* Active Route Indicator: Crisp Black Dot */}
                  {isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A] mt-0.5 animate-in fade-in zoom-in duration-200" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-transparent mt-0.5" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
