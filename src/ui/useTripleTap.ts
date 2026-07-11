/**
 * useTripleTap — returns an onClick handler that fires `onTrigger` after three
 * quick taps/clicks within a short window. Used to reveal the hidden debug menu
 * from the logo/title.
 */
import { useCallback, useRef } from 'react';

export function useTripleTap(onTrigger: () => void, taps = 3, windowMs = 1200): () => void {
  const count = useRef(0);
  const timer = useRef<number | null>(null);

  return useCallback(() => {
    count.current += 1;
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (count.current >= taps) {
      count.current = 0;
      onTrigger();
      return;
    }
    timer.current = window.setTimeout(() => {
      count.current = 0;
    }, windowMs);
  }, [onTrigger, taps, windowMs]);
}
