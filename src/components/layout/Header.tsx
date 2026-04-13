"use client";

import { ChevronLeft, ChevronRight, LogOut, Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { SessionPayload } from "@/lib/types";

type HeaderProps = {
  session: SessionPayload;
  weekOffset: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  currentWeekLabel: string;
};

export function Header({
  session,
  weekOffset,
  onPrevWeek,
  onNextWeek,
  onToday,
  currentWeekLabel,
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
    <header
      style={{
        height: "56px",
        backgroundColor: "var(--color-parchment)",
        borderBottom: "1px solid var(--color-cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-6)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Left: Wordmark */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        <Image
          src="/roo/roo-avatar.svg"
          alt="Roo"
          width={24}
          height={24}
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "var(--text-lg)",
            fontWeight: 400,
            color: "var(--color-ink)",
            letterSpacing: "-0.02em",
          }}
        >
          CalRoo
        </span>
      </div>

      {/* Center: Week navigation */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-ink-soft)",
            marginRight: "var(--space-2)",
          }}
        >
          {currentWeekLabel}
        </span>
        {weekOffset !== 0 && (
          <button
            type="button"
            onClick={onToday}
            style={{
              height: "36px",
              padding: "0 var(--space-3)",
              backgroundColor: "var(--color-linen)",
              border: "1px solid var(--color-cream)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-dm-sans), sans-serif",
              fontWeight: 500,
              color: "var(--color-ink)",
              cursor: "pointer",
            }}
          >
            Today
          </button>
        )}
        <button
          type="button"
          onClick={onPrevWeek}
          aria-label="Previous week"
          style={iconButtonStyle}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Next week"
          style={iconButtonStyle}
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Right: Dark mode + user */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
      >
        <button
          type="button"
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          style={iconButtonStyle}
        >
          {isDark ? (
            <Sun size={16} strokeWidth={1.5} />
          ) : (
            <Moon size={16} strokeWidth={1.5} />
          )}
        </button>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-full)",
              overflow: "hidden",
              border: "2px solid var(--color-cream)",
              cursor: "pointer",
              padding: 0,
              backgroundColor: "var(--color-mahogany)",
              color: "white",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {session.avatarUrl ? (
              <Image
                src={''}
                alt={session.name}
                width={32}
                height={32}
              />
            ) : (
              session.name.charAt(0).toUpperCase()
            )}
          </button>

          {showUserMenu && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + var(--space-2))",
                right: 0,
                backgroundColor: "var(--color-parchment)",
                border: "1px solid var(--color-cream)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                minWidth: "180px",
                padding: "var(--space-2)",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderBottom: "1px solid var(--color-cream)",
                  marginBottom: "var(--space-2)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--color-ink)",
                  }}
                >
                  {session.name}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-ink-soft)",
                  }}
                >
                  {session.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-ink)",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-dm-sans), sans-serif",
                }}
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

const iconButtonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "none",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  color: "var(--color-ink-soft)",
};
