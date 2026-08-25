'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom'
import { X } from 'lucide-react';
import { ScrollHint } from '@/components/ui/scroll-hint';

const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer() {
  return useContext(PortalContainerContext);
}

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement;
  children: ReactNode;
}) {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  );
}

/** The panel's slide-out is 300ms; keep painting just past it so the
 *  close animation finishes before the sheet stops rendering. */
const CLOSE_PAINT_MS = 320;

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
  className?: string;
  closeThreshold?: number;
  velocityThreshold?: number;
  hideHandle?: boolean;
  maxHeight?: string;
  zIndex?: string;
  panelStyle?: React.CSSProperties;
  onContentScroll?: (scrollTop: number) => void;
  resetScrollKey?: string;
  /** Top-right dismiss control. On a phone there is no Escape key, so
   *  this is on by default — a sheet whose only exit is the backdrop is
   *  a sheet people poke at. */
  hideCloseButton?: boolean;
  /** Announced by the close control and the dialog itself. */
  label?: string;
}

export function BottomSheet({
  open,
  onClose,
  children,
  header,
  className = '',
  closeThreshold = 100,
  velocityThreshold = 0.5,
  hideHandle = false,
  maxHeight = '90dvh',
  zIndex = 'z-[60]',
  panelStyle,
  onContentScroll,
  resetScrollKey,
  hideCloseButton = false,
  label,
}: BottomSheetProps) {
  const dragAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  // True once a pull-down that STARTED on the content has taken over as
  // a sheet drag — see the body drag listeners below.
  const bodyDragEngaged = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const portalContainer = useContext(PortalContainerContext);

  useEffect(() => {
    setMounted(true);
  }, []);

  // <ScrollHint> owns the overflow affordance now; this listener exists
  // only to feed onContentScroll (the collapsible header's trigger).
  useEffect(() => {
    if (!open || !onContentScroll) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => onContentScroll(container.scrollTop);
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [open, onContentScroll]);

  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (resetScrollKey == null) return;
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = 0;
  }, [resetScrollKey]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);

      if (!portalContainer) {
        const scrollY = window.scrollY;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
      }
    } else if (!portalContainer) {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (!portalContainer) {
        const scrollY = document.body.style.top;
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
        }
      }
    };
  }, [open, onClose, portalContainer]);

  // Prevent scroll propagation at content boundaries (iOS Safari fix).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !open) return;

    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaY = e.touches[0].clientY - startY;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
    };
  }, [open]);

  useEffect(() => {
    const dragArea = dragAreaRef.current;
    const container = scrollContainerRef.current;
    if (!dragArea || !open) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (touchStartY.current === null) return;

      const deltaY = e.touches[0].clientY - touchStartY.current;
      setDragOffset(Math.max(0, deltaY));
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartY.current === null || touchStartTime.current === null) {
        setIsDragging(false);
        return;
      }

      const endY = e.changedTouches[0].clientY;
      const deltaY = endY - touchStartY.current;
      const deltaTime = Date.now() - touchStartTime.current;
      const velocity = deltaTime > 0 ? deltaY / deltaTime : 0;

      if (deltaY > closeThreshold || velocity > velocityThreshold) {
        onClose();
      }

      // ALWAYS release the offset, including when we just asked to close:
      // `onClose` is allowed to decline (a paged sheet can go back
      // instead, a dirty form can hold itself open to warn), and a
      // declined drag that kept its offset left the panel parked
      // half off-screen with no way to put it back. When the close IS
      // honored, `open` flips false and the panel translates fully out,
      // so releasing costs nothing.
      setDragOffset(0);

      touchStartY.current = null;
      touchStartTime.current = null;
      setIsDragging(false);
    };

    dragArea.addEventListener('touchstart', handleTouchStart, { passive: true });
    dragArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    dragArea.addEventListener('touchend', handleTouchEnd, { passive: true });

    // PULL ANYWHERE TO CLOSE. With the content scrolled to the very top,
    // dragging DOWN on it drags the sheet out — you don't have to find
    // the handle, which is a 6px bar. While the content is scrolled,
    // every move re-anchors the start point instead, so scrolling keeps
    // its ordinary gesture and only a fresh pull from the top engages.
    const bodyTouchStart = (e: TouchEvent) => {
      bodyDragEngaged.current = false;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
    };

    const bodyTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null || !container) return;
      if (container.scrollTop > 0) {
        bodyDragEngaged.current = false;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        return;
      }
      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 0) {
        e.preventDefault();
        bodyDragEngaged.current = true;
        setIsDragging(true);
        setDragOffset(deltaY);
      }
    };

    const bodyTouchEnd = (e: TouchEvent) => {
      if (!bodyDragEngaged.current) {
        touchStartY.current = null;
        touchStartTime.current = null;
        return;
      }
      bodyDragEngaged.current = false;
      handleTouchEnd(e);
    };

    container?.addEventListener('touchstart', bodyTouchStart, { passive: true });
    container?.addEventListener('touchmove', bodyTouchMove, { passive: false });
    container?.addEventListener('touchend', bodyTouchEnd, { passive: true });

    return () => {
      dragArea.removeEventListener('touchstart', handleTouchStart);
      dragArea.removeEventListener('touchmove', handleTouchMove);
      dragArea.removeEventListener('touchend', handleTouchEnd);
      container?.removeEventListener('touchstart', bodyTouchStart);
      container?.removeEventListener('touchmove', bodyTouchMove);
      container?.removeEventListener('touchend', bodyTouchEnd);
    };
  }, [open, onClose, closeThreshold, velocityThreshold]);

  const panelTransform = open ? `translateY(${dragOffset}px)` : 'translateY(100%)';

  /**
   * Whether this sheet paints at all. Tracks `open` but lags it on the
   * way out so the 300ms slide-down still plays.
   *
   * A closed panel is only translateY(100%) away — it still PAINTS, and
   * `shadow-2xl` on a `rounded-t-[2rem]` top edge bleeds back up into the
   * bottom of the screen. The league shell mounts ELEVEN of these at
   * once, which stacked eleven shadows into curved bands above the dock
   * with no visible cause. `visibility` is the right tool three times
   * over: it suppresses painting including shadows, it takes the closed
   * dialogs out of the accessibility tree, and (unlike opacity) it
   * doesn't isolate the subtree into an offscreen group — which is what
   * used to stop the backdrop's blur from resolving until the fade had
   * already finished.
   */
  const [painted, setPainted] = useState(open);
  useEffect(() => {
    if (open) {
      setPainted(true);
      return;
    }
    const t = setTimeout(() => setPainted(false), CLOSE_PAINT_MS);
    return () => clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      // No opacity fade on this container — see `painted` above. What's
      // visible is carried entirely by the children: the backdrop's own
      // colour and blur, and the panel's transform.
      className={`fixed inset-0 ${zIndex} ${painted ? 'visible' : 'invisible'} ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* The blur ramps through backdrop-filter itself while the element
          stays at opacity 1. Fading opacity instead isolated the subtree
          and suppressed the blur until the transition ended, which read
          as the blur popping in after the sheet had already arrived. */}
      <div
        className="absolute inset-0"
        style={{
          touchAction: 'none',
          backgroundColor: open ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
          backdropFilter: open ? 'blur(4px)' : 'blur(0px)',
          WebkitBackdropFilter: open ? 'blur(4px)' : 'blur(0px)',
          transition:
            'background-color 300ms ease, backdrop-filter 300ms ease, -webkit-backdrop-filter 300ms ease',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[2rem] shadow-2xl ${
          isDragging ? '' : 'transition-transform duration-300 ease-out'
        } ${className}`}
        style={{
          ...panelStyle,
          transform: panelTransform,
          maxHeight,
          overscrollBehavior: 'contain',
        }}
      >
        {/* THE GRAB RAIL — the whole width of it, and tall enough to
            hit. With a header the bar OVERLAYS it, so edge-to-edge
            imagery stays edge-to-edge; without one the rail is a real
            44px row in the flow.

            It had to become one: an absolutely-positioned handle inside
            an otherwise empty div gave the drag area a height of ZERO.
            The bar painted straight through the first line of content,
            and the only thing you could actually pull was the 6px bar
            itself — which, with no close button anywhere, left tapping
            the backdrop as the only reliable way out of any sheet. */}
        <div
          ref={dragAreaRef}
          className={`relative shrink-0 cursor-grab rounded-t-[2rem] ${
            header ? 'overflow-hidden' : ''
          }`}
          style={{ touchAction: 'none' }}
        >
          {header}

          {!hideHandle && (
            <div
              className={
                header
                  ? 'absolute inset-x-0 top-0 z-10 flex justify-center pt-3 pb-2.5'
                  : 'flex h-11 items-center justify-center'
              }
            >
              <div className="h-1.5 w-12 rounded-full bg-white/35 shadow-sm" />
            </div>
          )}

          {/* An X, because a phone has no Escape key and a backdrop tap
              is a guess. It rides the rail, so it costs no extra room. */}
          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label={label ? `Close ${label}` : 'Close'}
              style={{ touchAction: 'manipulation' }}
              className="text-muted-foreground/60 hover:text-foreground absolute top-0 right-0.5 z-20 flex h-11 w-11 items-center justify-center rounded-full transition-colors active:scale-95"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>

        <div
          ref={scrollContainerRef}
          className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain"
          // The home indicator sits where the last row used to: a sheet
          // that reaches the bottom edge put SIGN OUT under the user's
          // thumb-swipe zone.
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {children}
        </div>

        {/* Overflow cue: the content blurs out under a mask at the
            edges, plus a chip while there's real distance left. */}
        <ScrollHint containerRef={scrollContainerRef} />
      </div>
    </div>,
    portalContainer ?? document.body
  );
}
