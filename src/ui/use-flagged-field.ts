import { useEffect, useRef } from "preact/hooks";

/**
 * The field a step is waiting for. Pressing Next with it empty sets
 * `WizardCtx.flagged`; this is the other half — the cursor goes into the
 * field and the field comes to the middle of the screen. Focus alone scrolls
 * as little as it can get away with, which on a phone leaves the input under
 * the sticky Next bar: an error message nobody can see is not one.
 */
export function useFlaggedField<T extends HTMLElement>(flagged: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!flagged) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, [flagged]);
  return ref;
}
