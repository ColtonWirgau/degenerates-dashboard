'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCollapsibleHeaderOptions {
  enabled: boolean;
  ratio: number;
}

/**
 * Internal hook that drives the collapsible header animation.
 * All DOM manipulation is done directly on the refs for 60fps performance.
 */
export function useCollapsibleHeader({ enabled, ratio }: UseCollapsibleHeaderOptions) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fullHeightRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);

  const contentCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node && enabled) setMounted(true);
    },
    [enabled]
  );

  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    fullHeightRef.current = content.offsetHeight;
  }, []);

  const reset = useCallback(() => {
    if (!enabled) return;
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (wrapper) wrapper.style.height = '';
    if (content) content.style.transform = '';
    requestAnimationFrame(measure);
  }, [enabled, measure]);

  const handleScroll = useCallback(
    (scrollTop: number) => {
      if (!enabled) return;
      const wrapper = wrapperRef.current;
      const content = contentRef.current;
      if (!wrapper || !content) return;

      let full = fullHeightRef.current;
      if (!full) {
        full = content.offsetHeight;
        fullHeightRef.current = full;
        if (!full) return;
      }

      const collapsed = full * ratio;
      const scrollRange = full - collapsed;
      const fraction = Math.min(Math.max(scrollTop / scrollRange, 0), 1);

      if (fraction === 0) {
        wrapper.style.height = '';
        content.style.transform = '';
        return;
      }

      const h = full + (collapsed - full) * fraction;
      const scale = 1 + (ratio - 1) * fraction;
      wrapper.style.height = `${h}px`;
      content.style.transform = `scale(${scale})`;
    },
    [enabled, ratio]
  );

  useEffect(() => {
    if (!enabled || !mounted) return;
    const content = contentRef.current;
    if (!content) return;

    const raf = requestAnimationFrame(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(content);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [enabled, mounted, measure]);

  return { wrapperRef, contentCallbackRef, handleScroll, measure, reset };
}
