'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

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
  showScrollIndicator?: boolean;
  lightScrollIndicator?: boolean;
  panelStyle?: React.CSSProperties;
  onContentScroll?: (scrollTop: number) => void;
  resetScrollKey?: string;
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
  showScrollIndicator = true,
  lightScrollIndicator = false,
  panelStyle,
  onContentScroll,
  resetScrollKey,
}: BottomSheetProps) {
  const dragAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [mounted, setMounted] = useState(false);
  const portalContainer = useContext(PortalContainerContext);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkScrollIndicator = useCallback(() => {
    if (!showScrollIndicator) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const hasMoreContent = container.scrollHeight > container.clientHeight + 5;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 20;

    setShowIndicator(hasMoreContent && !isAtBottom);
  }, [showScrollIndicator]);

  useEffect(() => {
    if (!showScrollIndicator || !open) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollIndicator();
    const timeouts = [
      setTimeout(checkScrollIndicator, 50),
      setTimeout(checkScrollIndicator, 150),
      setTimeout(checkScrollIndicator, 300),
    ];

    const handleScroll = () => {
      checkScrollIndicator();
      onContentScroll?.(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', checkScrollIndicator);

    const resizeObserver = new ResizeObserver(checkScrollIndicator);
    resizeObserver.observe(container);
    if (container.firstElementChild) {
      resizeObserver.observe(container.firstElementChild);
    }

    return () => {
      timeouts.forEach(clearTimeout);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkScrollIndicator);
      resizeObserver.disconnect();
    };
  }, [open, showScrollIndicator, checkScrollIndicator, onContentScroll]);

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
      } else {
        setDragOffset(0);
      }

      touchStartY.current = null;
      touchStartTime.current = null;
      setIsDragging(false);
    };

    dragArea.addEventListener('touchstart', handleTouchStart, { passive: true });
    dragArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    dragArea.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      dragArea.removeEventListener('touchstart', handleTouchStart);
      dragArea.removeEventListener('touchmove', handleTouchMove);
      dragArea.removeEventListener('touchend', handleTouchEnd);
    };
  }, [open, onClose, closeThreshold, velocityThreshold]);

  const panelTransform = open ? `translateY(${dragOffset}px)` : 'translateY(100%)';

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndex} transition-opacity duration-300 ${
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ touchAction: 'none' }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-[2rem] shadow-2xl ${
          isDragging ? '' : 'transition-transform duration-300 ease-out'
        } ${className}`}
        style={{
          ...panelStyle,
          transform: panelTransform,
          maxHeight,
          overscrollBehavior: 'contain',
        }}
      >
        <div
          ref={dragAreaRef}
          className="relative shrink-0 cursor-grab overflow-hidden rounded-t-[2rem]"
          style={{ touchAction: 'none' }}
        >
          {header}

          {!hideHandle && (
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-3 pb-2">
              <div className="h-1.5 w-14 rounded-full bg-white/50 shadow-sm" />
            </div>
          )}
        </div>

        <div ref={scrollContainerRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        <AnimatePresence>
          {showIndicator && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase text-neon-blue [text-shadow:0_0_12px_rgba(0,217,255,0.5)]">
                <span>Scroll for more</span>
                <motion.div
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ChevronDown className="h-3 w-3" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    portalContainer ?? document.body
  );
}
