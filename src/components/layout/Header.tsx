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
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute(
      "data-theme",
      next ? "dark" : "light",
    );
    localStorage.setItem("calroo-theme", next ? "dark" : "light");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="h-14 bg-(--color-parchment) border-b border-(--color-cream) flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Left: Wordmark */}
      <div className="flex items-center gap-2">
        <Image
          src="/roo/roo-avatar.svg"
          alt="Roo"
          width={24}
          height={24}
          className="shrink-0"
        />
        <span
          className="text-lg font-normal text-(--color-ink) tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          CalRoo
        </span>
      </div>

      {/* Center: View toggle + navigation */}
      <div className="flex items-center gap-3">
        {/* Week / Month toggle */}
        <div className="flex border border-(--color-cream) rounded overflow-hidden">
          {(["week", "month"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={[
                "h-8 px-3 border-0 text-sm font-medium cursor-pointer transition-colors duration-150 ease-in-out capitalize",
                viewMode === mode
                  ? "bg-(--color-mahogany) text-white"
                  : "bg-(--color-linen) text-(--color-ink-soft)",
              ].join(" ")}
              style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-(--color-ink-soft)">
            {currentLabel}
          </span>
          {offset !== 0 && (
            <button
              type="button"
              onClick={onToday}
              className="h-8 px-3 bg-(--color-linen) border border-(--color-cream) rounded text-sm font-medium text-(--color-ink) cursor-pointer"
              style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={onPrev}
            aria-label={`Previous ${viewMode}`}
            className={iconButtonClass}
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={`Next ${viewMode}`}
            className={iconButtonClass}
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Right: Dark mode + user */}
      <div className="flex items-center gap-2">
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
            {session.avatarUrl ? (
              // biome-ignore lint/style/noNonNullAssertion: need url
              <img src={session.avatarUrl} alt={session.name} width={32} height={32} />
            ) : (
              session.name.charAt(0).toUpperCase()
            )}
          </button>

          {showUserMenu && (
            <div className="absolute top-[calc(100%+8px)] right-0 bg-(--color-parchment) border border-(--color-cream) rounded-md shadow-(--shadow-lg) min-w-[180px] p-2 z-100">
              <div className="py-2 px-3 border-b border-(--color-cream) mb-2">
                <div className="text-sm font-medium text-(--color-ink)">
                  {session.name}
                </div>
                <div className="text-xs text-(--color-ink-soft)">
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
    </header>
  );
}

const iconButtonClass =
  "w-9 h-9 flex items-center justify-center border-0 bg-transparent rounded cursor-pointer text-(--color-ink-soft)";
