"use client";

import { useFormStatus } from "react-dom";

import { buttonPrimary } from "@/app/erp/_components/forms";

/** Disabled while it goes, so a second click cannot send it twice. */
export function SendButton({ again, to }: { again: boolean; to: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ ...buttonPrimary, opacity: pending ? 0.6 : 1 }}>
      {pending ? "Sending" : again ? "Send it again" : `Send it${to ? ` to ${to}` : ""}`}
    </button>
  );
}
