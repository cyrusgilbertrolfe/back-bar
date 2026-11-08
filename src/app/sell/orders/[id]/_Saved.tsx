import { COLOR } from "@/lib/design";


/** Shown after a save, then fades. The key remounts it, so a second save shows again. */
export function Saved() {
  return (
    <>
      <style>{"@keyframes saved-fade { 0%, 70% { opacity: 1 } 100% { opacity: 0; visibility: hidden } }"}</style>
      <div
        role="status"
        style={{ position: "fixed", right: 24, bottom: 24, background: COLOR.ink, color: COLOR.paper, padding: "10px 18px", fontSize: 12, letterSpacing: "0.06em", fontWeight: 500, textTransform: "uppercase", animation: "saved-fade 4s forwards", zIndex: 50 }}
      >
        Saved
      </div>
    </>
  );
}
