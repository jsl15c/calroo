"use client";

import { ArrowUp, PanelRightClose, Square } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CalendarEvent, ChatMessage, ConfirmationCard } from "@/lib/types";
import { shortId } from "@/lib/utils";
import { ConfirmationCard as ConfirmationCardComponent } from "./ConfirmationCard";

const SUGGESTION_CHIPS = [
  "What does my week look like?",
  "How much time am I in meetings?",
  "Help me block mornings for focus time",
];

type ChatPanelProps = {
  events: CalendarEvent[];
  timezone: string;
  onCalendarRefresh: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function ChatPanel({
  timezone,
  onCalendarRefresh,
  isCollapsed,
  onToggleCollapse,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll when message count changes
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      setShowChips(false);
      const userMessage: ChatMessage = {
        id: shortId(),
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsStreaming(true);

      const assistantId = shortId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const history = messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), history, timezone }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            const eventLine = lines
              .slice(0, lines.indexOf(line))
              .findLast((l) => l.startsWith("event: "));
            const eventType = eventLine?.slice(7) ?? "token";

            if (eventType === "token" || (!eventLine && data !== "{}")) {
              try {
                const parsed = JSON.parse(data) as { text: string };
                if (parsed.text) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + parsed.text }
                        : m,
                    ),
                  );
                }
              } catch {
                // skip
              }
            }

            if (eventType === "confirmation") {
              try {
                const card = JSON.parse(data) as ConfirmationCard;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, confirmationCard: card } : m,
                  ),
                );
              } catch {
                // skip
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "I seem to have dropped something. One moment, please.",
                }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, timezone],
  );

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleConfirm = async (card: ConfirmationCard) => {
    const url =
      card.action === "create"
        ? "/api/calendar/events"
        : `/api/calendar/events/${card.existingEventId}`;

    const method =
      card.action === "delete"
        ? "DELETE"
        : card.action === "create"
          ? "POST"
          : "PATCH";
    const body =
      card.action !== "delete" ? JSON.stringify(card.event) : undefined;

    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    onCalendarRefresh();
  };

  if (isCollapsed) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--color-parchment)",
        borderLeft: "1px solid var(--color-cream)",
        boxShadow: "-4px 0 16px rgba(28, 25, 23, 0.06)",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--space-4)",
          borderBottom: "1px solid var(--color-cream)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--color-ink)",
          }}
        >
          Chat with Roo
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Collapse chat panel"
          style={{
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--color-ink-soft)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <PanelRightClose size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        }}
      >
        {/* Welcome message */}
        {messages.length === 0 && (
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "flex-start",
            }}
          >
            <Image
              src="/roo/roo-avatar.svg"
              alt="Roo"
              width={28}
              height={28}
              style={{ flexShrink: 0, marginTop: "2px" }}
            />
            <div>
              <div
                style={{
                  backgroundColor: "var(--color-linen)",
                  borderRadius: "var(--radius-md)",
                  borderBottomLeftRadius: "2px",
                  padding: "var(--space-3) var(--space-4)",
                  maxWidth: "85%",
                  color: "var(--color-ink)",
                  fontSize: "var(--text-base)",
                  lineHeight: 1.5,
                }}
              >
                Good day. At your service.
              </div>

              {/* Suggestion chips */}
              {showChips && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => sendMessage(chip)}
                      style={{
                        textAlign: "left",
                        backgroundColor: "var(--color-linen)",
                        border: "1px solid var(--color-cream)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-2) var(--space-3)",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-ink)",
                        cursor: "pointer",
                        fontFamily: "var(--font-dm-sans), sans-serif",
                        transition: "background-color 150ms ease",
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((message, idx) => {
          const isUser = message.role === "user";
          const prevMessage = idx > 0 ? messages[idx - 1] : null;
          const isFirstInGroup =
            !prevMessage || prevMessage.role !== message.role;

          return (
            <div
              key={message.id}
              style={{
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                gap: "var(--space-3)",
                alignItems: "flex-start",
                animation: "fadeSlideUp 200ms ease-out",
              }}
            >
              {!isUser && isFirstInGroup && (
                <Image
                  src="/roo/roo-avatar.svg"
                  alt="Roo"
                  width={28}
                  height={28}
                  style={{ flexShrink: 0, marginTop: "2px" }}
                />
              )}
              {!isUser && !isFirstInGroup && (
                <div style={{ width: "28px", flexShrink: 0 }} />
              )}

              <div
                style={{
                  maxWidth: "85%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                {/* Text bubble */}
                {(message.content || isStreaming) && (
                  <div
                    style={{
                      backgroundColor: isUser
                        ? "var(--color-mahogany)"
                        : "var(--color-linen)",
                      color: isUser ? "white" : "var(--color-ink)",
                      borderRadius: "var(--radius-md)",
                      ...(isUser
                        ? { borderBottomRightRadius: "2px" }
                        : { borderBottomLeftRadius: "2px" }),
                      padding: "var(--space-3) var(--space-4)",
                      fontSize: "var(--text-base)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {message.content ||
                      (isStreaming && idx === messages.length - 1 ? (
                        <StreamingDots />
                      ) : null)}
                  </div>
                )}

                {/* Confirmation card */}
                {message.confirmationCard && (
                  <ConfirmationCardComponent
                    card={message.confirmationCard}
                    onConfirm={handleConfirm}
                    onDismiss={() => {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === message.id
                            ? { ...m, confirmationCard: undefined }
                            : m,
                        ),
                      );
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: "1px solid var(--color-cream)",
          padding: "var(--space-3) var(--space-4)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "flex-end",
            backgroundColor: "var(--color-linen)",
            border: "1px solid var(--color-cream)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2)",
            transition: "border-color 150ms ease",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--color-mahogany)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--color-cream)";
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask Roo anything about your schedule..."
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              background: "none",
              outline: "none",
              fontSize: "var(--text-base)",
              fontFamily: "var(--font-dm-sans), sans-serif",
              color: "var(--color-ink)",
              maxHeight: "120px",
              overflowY: "auto",
              lineHeight: 1.5,
            }}
          />
          <button
            type="button"
            onClick={isStreaming ? handleStop : () => sendMessage(input)}
            aria-label={isStreaming ? "Stop response" : "Send message"}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-full)",
              backgroundColor: isStreaming
                ? "var(--color-ink-soft)"
                : "var(--color-brass)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              flexShrink: 0,
              transition: "background-color 150ms ease",
            }}
          >
            {isStreaming ? (
              <Square size={14} fill="white" strokeWidth={0} />
            ) : (
              <ArrowUp size={16} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        alignItems: "center",
        padding: "var(--space-3)",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "var(--color-brass)",
            animation: `dot-pulse 600ms ease-in-out ${i * 150}ms infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
