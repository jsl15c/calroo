"use client";

import { ChevronLeft, ChevronRight, LogOut, Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { SessionPayload } from "@/lib/types";

type HeaderProps = {
  session: SessionPayload;
  viewMode: "week" | "month";
  onViewModeChange: (mode: "week" | "month") => void;
  offset: number; // weekOffset or monthOffset — used only to know if "Today" is needed
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  currentLabel: string;
};

export function Header({
  session,
  viewMode,
  onViewModeChange,
  offset,
  onPrev,
  onNext,
  onToday,
  currentLabel,
}: HeaderProps) {
  const [isDark, setIsDark] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("calroo-theme");
    if (stored === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setIsDark(true);
    } else if (stored === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      setIsDark(false);
    } else {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(systemDark);
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("calroo-theme", next ? "dark" : "light");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="bg-(--color-parchment) border-b border-(--color-cream) sticky top-0 z-10">
      {/* Main row */}
      <div className="h-14 flex items-center justify-between px-3 md:px-6 gap-2">

        {/* Left: Wordmark */}
        <div className="flex items-center gap-2 shrink-0">
          <Image
            src="/roo/roo-avatar.svg"
            alt="Roo"
            width={24}
            height={24}
            className="shrink-0"
          />
          <span
            className="text-lg font-normal text-(--color-ink) tracking-[-0.02em] hidden sm:block"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            CalRoo
          </span>
        </div>

        {/* Center: View toggle + navigation */}
        <div className="flex items-center gap-1 md:gap-3 flex-1 justify-center min-w-0">
          {/* Week / Month toggle */}
          <div className="flex border border-(--color-cream) rounded overflow-hidden shrink-0">
            {(["week", "month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={[
                  "h-8 border-0 font-medium cursor-pointer transition-colors duration-150 ease-in-out",
                  "px-2 text-xs md:px-3 md:text-sm",
                  viewMode === mode
                    ? "bg-(--color-mahogany) text-white"
                    : "bg-(--color-linen) text-(--color-ink-soft)",
                ].join(" ")}
                style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
              >
                {/* Abbreviated on small screens */}
                <span className="md:hidden">{mode === "week" ? "Wk" : "Mo"}</span>
                <span className="hidden md:inline capitalize">{mode}</span>
              </button>
            ))}
          </div>

          {/* Navigation arrows + label */}
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={onPrev}
              aria-label={`Previous ${viewMode}`}
              className={iconButtonClass}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>

            {/* Label — hidden on mobile, shown on md+ */}
            <span className="hidden md:block text-sm text-(--color-ink-soft) whitespace-nowrap px-1 truncate">
              {currentLabel}
            </span>

            <button
              type="button"
              onClick={onNext}
              aria-label={`Next ${viewMode}`}
              className={iconButtonClass}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>

            {offset !== 0 && (
              <button
                type="button"
                onClick={onToday}
                className="h-8 px-2 md:px-3 bg-(--color-linen) border border-(--color-cream) rounded text-xs md:text-sm font-medium text-(--color-ink) cursor-pointer shrink-0"
                style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Right: Dark mode + user */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            className={iconButtonClass}
          >
            {isDark ? (
              <Sun size={16} strokeWidth={1.5} />
            ) : (
              <Moon size={16} strokeWidth={1.5} />
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu((v) => !v)}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-(--color-cream) cursor-pointer p-0 bg-(--color-mahogany) text-white text-xs font-semibold flex items-center justify-center"
            >
              {session.name.charAt(0).toUpperCase()}
            </button>

            {showUserMenu && (
              <div className="absolute top-[calc(100%+8px)] right-0 bg-(--color-parchment) border border-(--color-cream) rounded-md shadow-(--shadow-lg) min-w-[180px] p-2 z-100">
                <div className="py-2 px-3 border-b border-(--color-cream) mb-2">
                  <div className="text-sm font-medium text-(--color-ink)">
                    {session.name}
                  </div>
                  <div className="text-xs text-(--color-ink-soft) truncate max-w-[160px]">
                    {session.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full py-2 px-3 border-0 bg-transparent cursor-pointer text-sm text-(--color-ink) rounded"
                  style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
                >
                  <LogOut size={14} strokeWidth={1.5} />
                  Until next time
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only sub-row: current period label */}
      <div className="md:hidden border-t border-(--color-cream) px-4 py-1.5 text-center text-xs text-(--color-ink-soft) truncate">
        {currentLabel}
      </div>
    </header>
  );
}

const iconButtonClass =
  "w-8 h-8 md:w-9 md:h-9 flex items-center justify-center border-0 bg-transparent rounded cursor-pointer text-(--color-ink-soft)";
