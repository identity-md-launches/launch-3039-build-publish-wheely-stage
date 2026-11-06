import { useEffect, useState } from "react";
import { applyFailure, applyStatus, initialLiveState, type LiveState } from "./live";
import { startPoller } from "./poller";

export function useLive(): LiveState {
  const [state, setState] = useState<LiveState>(initialLiveState);
  useEffect(
    () =>
      startPoller({
        onStatus: (status) => setState((s) => applyStatus(s, status, Date.now())),
        onFailure: () => setState((s) => applyFailure(s, Date.now())),
      }),
    [],
  );
  return state;
}

const CAPTION_MS = 8000;

/** The caption for the newest settled round, for as long as it should stay on screen. */
export function useCaption(live: LiveState): string | null {
  const celebration = live.celebration;
  const [visible, setVisible] = useState<number | null>(null);
  useEffect(() => {
    if (!celebration) return;
    setVisible(celebration.id);
    const timer = setTimeout(() => setVisible(null), CAPTION_MS);
    return () => clearTimeout(timer);
  }, [celebration]);
  return celebration && visible === celebration.id ? celebration.caption : null;
}
