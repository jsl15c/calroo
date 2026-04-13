"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import type { ConfirmationCard as ConfirmationCardType } from "@/lib/types";
import { formatFullDate, formatTimeRange } from "@/lib/utils";

type ConfirmationCardProps = {
  card: ConfirmationCardType;
  onConfirm: (card: ConfirmationCardType) => Promise<void>;
  onDismiss: () => void;
};

export function ConfirmationCard({
  card,
  onConfirm,
  onDismiss,
}: ConfirmationCardProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const actionLabel = {
    create: "New Appointment",
    update: "Update Appointment",
    delete: "Cancel Appointment",
  }[card.action];

  const handleConfirm = async () => {
    setStatus("loading");
    try {
      await onConfirm(card);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            color: "var(--color-success)",
          }}
        >
          <Check size={16} strokeWidth={1.5} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
            {card.action === "delete"
              ? "Appointment cancelled."
              : card.action === "update"
                ? "Appointment updated."
                : "Appointment added to your calendar."}
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ ...cardStyle, borderColor: "var(--color-error)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            color: "var(--color-error)",
          }}
        >
          <X size={16} strokeWidth={1.5} />
          <span style={{ fontSize: "var(--text-sm)" }}>
            I seem to have dropped something. One moment, please.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-brass)",
          marginBottom: "var(--space-3)",
        }}
      >
        {actionLabel}
      </div>

      {/* Event details */}
      <div
        style={{
          fontSize: "var(--text-base)",
          fontWeight: 500,
          color: "var(--color-ink)",
          fontFamily: "var(--font-playfair), serif",
          marginBottom: "var(--space-1)",
        }}
      >
        {card.event.title}
      </div>

      {card.action !== "delete" && (
        <>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-ink-soft)",
              marginBottom: "var(--space-1)",
            }}
          >
            {formatFullDate(card.event.start)} ·{" "}
            {formatTimeRange(card.event.start, card.event.end)}
          </div>

          {card.event.attendees.length > 0 && (
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-ink-soft)",
                marginBottom: "var(--space-1)",
              }}
            >
              {card.event.attendees.join(", ")}
            </div>
          )}

          {card.event.description && (
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-ink-soft)",
                marginTop: "var(--space-2)",
                fontStyle: "italic",
              }}
            >
              {card.event.description}
            </div>
          )}
        </>
      )}

      {card.action === "delete" && (
        <div
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-ink-soft)",
            marginTop: "var(--space-1)",
          }}
        >
          This appointment will be removed from your calendar.
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          marginTop: "var(--space-4)",
        }}
      >
        <button
          type="button"
          onClick={handleConfirm}
          disabled={status === "loading"}
          style={{
            height: "36px",
            padding: "0 var(--space-5)",
            backgroundColor:
              card.action === "delete"
                ? "var(--color-error)"
                : "var(--color-mahogany)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            fontFamily: "var(--font-dm-sans), sans-serif",
            cursor: status === "loading" ? "wait" : "pointer",
            opacity: status === "loading" ? 0.7 : 1,
            transition: "background-color 150ms ease, transform 100ms ease",
          }}
        >
          {status === "loading"
            ? "One moment..."
            : card.action === "delete"
              ? "Confirm cancellation"
              : "Confirm"}
        </button>

        <button
          type="button"
          onClick={onDismiss}
          disabled={status === "loading"}
          style={{
            height: "36px",
            padding: "0 var(--space-4)",
            backgroundColor: "var(--color-linen)",
            border: "1px solid var(--color-cream)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            fontFamily: "var(--font-dm-sans), sans-serif",
            cursor: "pointer",
            color: "var(--color-ink)",
          }}
        >
          Not quite
        </button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--color-linen)",
  border: "1px solid var(--color-cream)",
  borderLeft: "3px solid var(--color-brass)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
  maxWidth: "100%",
};
