'use client';

import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  Children,
  isValidElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom'
import { ScrollHint } from '@/components/ui/scroll-hint';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, X } from 'lucide-react';
import { BottomSheet, usePortalContainer } from './bottom-sheet';
import { SheetPage, type SheetPageProps } from './sheet-page';
import { CollapsibleHeader, type CollapsibleHeaderProps } from './collapsible-header';
import { useCollapsibleHeader } from './use-collapsible-header';
import type { SheetPageKebabItem } from './sheet-page-kebab';
import {
  ResponsiveSheetContext,
  type ResponsiveSheetContextValue,
  type SheetMode,
} from './responsive-sheet-context';
import { cn } from '@/lib/utils';

export { CollapsibleHeader, type CollapsibleHeaderProps };
export { SheetPage, type SheetPageProps };

interface ResponsiveSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode | ((context: ResponsiveSheetContextValue) => ReactNode);
  defaultPage?: string;
  maxWidth?: string;
  modalBreakpoint?: number;
  className?: string;
  panelClassName?: string;
  noPanelPadding?: boolean;
  sheetMaxHeight?: string;
  panelStyle?: React.CSSProperties;
  hideCloseButton?: boolean;
  /** Names the dialog, and the control that dismisses it. */
  label?: string;
}

/**
 * Hook to access ResponsiveSheet context. Provides mode, theme, and
 * navigation utilities.
 */
export function useResponsiveSheet() {
  const context = useContext(ResponsiveSheetContext);
  if (!context) {
    throw new Error('useResponsiveSheet must be used within a ResponsiveSheet');
  }
  return context;
}

const KEBAB_PAGE_NAME = '__sheetKebabActions';

/**
 * A sheet panel must never be transparent: callers often pass panelClassName
 * for layout tweaks without realizing it REPLACES the default panel chrome.
 * If the caller didn't bring a background themselves (a bg-* or glass-*
 * utility), keep the default chrome underneath whatever they passed.
 */
function withPanelDefaults(defaults: string, panelClassName?: string): string {
  const hasBg = /(^|\s)(bg-|glass)/.test(panelClassName ?? '');
  return hasBg ? panelClassName! : `${defaults} ${panelClassName ?? ''}`.trim();
}

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeInOut' as const,
  duration: 0.25,
};

interface SheetContentProps {
  pages: {
    name: string;
    title?: ReactNode;
    backBarTrailing?: ReactNode;
    content: ReactNode;
  }[];
  currentPage: string;
  canGoBack: boolean;
  onBack: () => void;
  mode: SheetMode;
  hasHeader?: boolean;
}

function useMeasuredHeight(): [(node: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    setHeight(node.getBoundingClientRect().height);
    observerRef.current = new ResizeObserver(([entry]) => {
      const target = entry.target as HTMLElement;
      setHeight(target.offsetHeight);
    });
    observerRef.current.observe(node);
  }, []);

  return [ref, height];
}

function SheetContent({
  pages,
  currentPage,
  canGoBack,
  onBack,
  hasHeader = false,
}: SheetContentProps) {
  const activePage = pages.find((p) => p.name === currentPage);
  const direction = currentPage === 'main' ? -1 : 1;

  // A headerless sheet has nothing under the grab rail but this, so it
  // owes the rail its height. `pt-2` was eight pixels against a rail
  // that needs about twenty-six, which is why every panel's heading came
  // out with the handle drawn straight through it.
  const topPadding = !hasHeader ? 'pt-1.5' : '';

  const [measureRef, contentHeight] = useMeasuredHeight();

  return (
    <motion.div
      animate={{ height: contentHeight > 0 ? contentHeight : 'auto' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.36 }}
      style={{ overflow: 'hidden' }}
      className={`relative ${topPadding}`}
    >
      {/* flow-root: contain child margins (the back-strip's mt-*) so they
          count in offsetHeight. Without it the margin collapses out of this
          div but renders inside the overflow-hidden parent, leaving the
          animated height short and clipping the page's bottom padding. */}
      <div ref={measureRef} className="flow-root">
        <AnimatePresence>
          {(canGoBack || activePage?.backBarTrailing) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Page header — title (+ trailing actions) in a bordered
                  section; the back link sits below it, content-side. */}
              {activePage?.title ? (
                <div className="flex items-center gap-2.5 border-b border-white/5 px-5 sm:px-6 pt-4 pb-3">
                  <span className="text-foreground min-w-0 flex-1 truncate text-base font-bold tracking-wide uppercase">
                    {activePage.title}
                  </span>
                  {activePage?.backBarTrailing && (
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {activePage.backBarTrailing}
                    </div>
                  )}
                </div>
              ) : null}

              <div
                className={
                  activePage?.title
                    ? 'mt-3 mb-3 flex items-center gap-4 px-5 sm:px-6'
                    : 'mt-4 mb-4 flex items-center gap-4 px-6'
                }
              >
                {canGoBack && (
                  <button
                    onClick={onBack}
                    className="text-muted-foreground hover:text-foreground -ml-1 flex items-center gap-1 text-xs font-semibold tracking-widest uppercase transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                {!activePage?.title && activePage?.backBarTrailing && (
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {activePage.backBarTrailing}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pageTransition}
          >
            {activePage?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * A responsive sheet that displays as a bottom sheet on mobile and a centered
 * modal on desktop. Supports multi-page navigation with smooth slide
 * transitions, optional collapsible header, and per-page action slots.
 */
export function ResponsiveSheet({
  open,
  onClose,
  children,
  header,
  defaultPage = 'main',
  maxWidth = 'max-w-3xl',
  modalBreakpoint = 768,
  className = '',
  panelClassName = '',
  noPanelPadding = false,
  sheetMaxHeight,
  panelStyle,
  hideCloseButton = false,
  label,
}: ResponsiveSheetProps) {
  const portalContainer = usePortalContainer();
  const [mode, setMode] = useState<SheetMode>('sheet');
  const [currentPage, setCurrentPage] = useState(defaultPage);
  const [history, setHistory] = useState<string[]>([defaultPage]);
  const [mounted, setMounted] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Modal mode portal-target needs `document` access — gate on mount so SSR
  // doesn't trip. After mount, we always portal to body (or the custom
  // container) so we escape any ancestor containing-block (eg. the header's
  // backdrop-filter, which silently captures fixed positioning).
  useEffect(() => {
    setMounted(true);
  }, []);
  const [kebabState, setKebabState] = useState<{
    items: SheetPageKebabItem[];
    title: string;
  } | null>(null);

  useEffect(() => {
    const checkMode = () => {
      setMode(window.innerWidth >= modalBreakpoint ? 'modal' : 'sheet');
    };

    checkMode();
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, [modalBreakpoint]);

  // Lock body scroll while the desktop modal is open. Sheet mode gets this
  // from BottomSheet; the modal branch renders its own overlay and otherwise
  // leaves the page scrollable behind the backdrop. Escape-to-close comes
  // along for parity with the sheet. Skipped for custom portal containers
  // (a widget doesn't own the host page's scroll).
  useEffect(() => {
    if (mode !== 'modal' || !open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);

    if (!portalContainer) {
      const scrollY = window.scrollY;
      // Lock both html and body (needed for iOS Safari)
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (!portalContainer) {
        const top = document.body.style.top;
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        if (top) {
          window.scrollTo(0, parseInt(top, 10) * -1);
        }
      }
    };
  }, [mode, open, onClose, portalContainer]);

  useEffect(() => {
    if (open) {
      setCurrentPage(defaultPage);
      setHistory(defaultPage === 'main' ? ['main'] : ['main', defaultPage]);
    } else {
      setCurrentPage(defaultPage);
      setHistory([defaultPage]);
      setKebabState(null);
    }
  }, [open, defaultPage]);

  const navigate = useCallback((page: string) => {
    setHistory((prev) => [...prev, page]);
    setCurrentPage(page);
  }, []);

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setCurrentPage(newHistory[newHistory.length - 1]);
    }
  }, [history]);

  const canGoBack = history.length > 1;

  const pushKebabPage = useCallback((items: SheetPageKebabItem[], title = 'Actions') => {
    setKebabState({ items, title });
    requestAnimationFrame(() => {
      setHistory((prev) => [...prev, KEBAB_PAGE_NAME]);
      setCurrentPage(KEBAB_PAGE_NAME);
    });
  }, []);

  const pages: {
    name: string;
    title?: ReactNode;
    header?: ReactNode;
    headerActions?: ReactNode;
    backBarTrailing?: ReactNode;
    content: ReactNode;
  }[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === SheetPage) {
      const {
        name,
        title,
        header: pageHeader,
        headerActions,
        backBarTrailing,
        children: pageChildren,
      } = child.props as SheetPageProps;
      pages.push({
        name,
        title,
        header: pageHeader,
        headerActions,
        backBarTrailing,
        content: pageChildren,
      });
    }
  });

  if (kebabState) {
    pages.push({
      name: KEBAB_PAGE_NAME,
      title: kebabState.title,
      content: (
        <KebabActionsPageContent
          items={kebabState.items}
          onSelected={() => {
            if (history.length > 1) {
              const newHistory = history.slice(0, -1);
              setHistory(newHistory);
              setCurrentPage(newHistory[newHistory.length - 1]);
            }
          }}
        />
      ),
    });
  }

  const activePage = pages.find((p) => p.name === currentPage);
  const activeHeaderActions = activePage?.headerActions;
  const onKebabPage = currentPage === KEBAB_PAGE_NAME;
  const inheritedKebabHeader =
    onKebabPage && history.length >= 2
      ? pages.find((p) => p.name === history[history.length - 2])?.header
      : undefined;
  const activePageHeader = inheritedKebabHeader ?? activePage?.header;

  const contextValue: ResponsiveSheetContextValue = {
    mode,
    resolvedTheme: 'dark',
    navigate,
    goBack,
    currentPage,
    canGoBack,
    pushKebabPage,
  };

  const sheetLevelHeader = typeof header === 'function' ? header(contextValue) : header;
  const resolvedHeader = activePageHeader ?? sheetLevelHeader;

  const isCollapsible =
    isValidElement(resolvedHeader) &&
    (resolvedHeader.type as { __isCollapsibleHeader?: boolean }).__isCollapsibleHeader === true;

  const collapsibleProps = isCollapsible ? (resolvedHeader.props as CollapsibleHeaderProps) : null;

  const collapsibleRatio = collapsibleProps?.ratio ?? 0.5;

  const {
    wrapperRef,
    contentCallbackRef,
    handleScroll: handleCollapsibleScroll,
    reset: resetCollapsible,
  } = useCollapsibleHeader({
    enabled: isCollapsible && mode === 'sheet',
    ratio: collapsibleRatio,
  });

  useEffect(() => {
    if (isCollapsible && mode === 'sheet') {
      resetCollapsible();
    }
  }, [currentPage, isCollapsible, mode, resetCollapsible]);

  const actionsOverlay = activeHeaderActions ? (
    <div className="pointer-events-none absolute top-3 right-3 z-30 md:top-4 md:right-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/30 bg-white/20 p-0.5 text-white shadow-sm backdrop-blur-md">
        {activeHeaderActions}
      </div>
    </div>
  ) : null;

  const wrapHeaderWithActions = (node: ReactNode): ReactNode =>
    activeHeaderActions ? (
      <div className="relative">
        {node}
        {actionsOverlay}
      </div>
    ) : (
      node
    );

  const sheetHeader = wrapHeaderWithActions(
    isCollapsible && collapsibleProps ? (
      <div ref={wrapperRef} className="relative overflow-hidden">
        {collapsibleProps.background && (
          <div className="absolute inset-0">{collapsibleProps.background}</div>
        )}
        <div ref={contentCallbackRef} className="relative origin-top">
          {collapsibleProps.children}
        </div>
      </div>
    ) : (
      resolvedHeader
    )
  );

  const modalHeader = wrapHeaderWithActions(
    isCollapsible && collapsibleProps ? collapsibleProps.children : resolvedHeader
  );

  // Default panel — near-black to match the app's #0A0A0A background, with
  // a subtle primary-tinted border so it reads as part of the cyberpunk
  // chrome rather than a foreign sheet.
  const defaultPanelClass = 'bg-[#0A0A0A] border-t border-primary/20';
  const panelClass = withPanelDefaults(defaultPanelClass, panelClassName);

  if (mode === 'sheet') {
    return (
      <ResponsiveSheetContext.Provider value={contextValue}>
        <BottomSheet
          open={open}
          onClose={onClose}
          className={panelClass}
          header={sheetHeader}
          hideHandle={false}
          maxHeight={sheetMaxHeight}
          panelStyle={panelStyle}
          onContentScroll={isCollapsible ? handleCollapsibleScroll : undefined}
          resetScrollKey={currentPage}
          // Same rule the modal branch uses: a page that brought its own
          // top-right actions owns that corner.
          hideCloseButton={hideCloseButton || !!activeHeaderActions}
          label={label}
        >
          <SheetContent
            pages={pages}
            currentPage={currentPage}
            canGoBack={canGoBack}
            onBack={goBack}
            mode={mode}
            hasHeader={!!sheetHeader}
          />
        </BottomSheet>
      </ResponsiveSheetContext.Provider>
    );
  }

  const modalPanelDefault = 'bg-[#0F0F12] border border-primary/30 rounded-2xl';
  const modalPanelClass = withPanelDefaults(modalPanelDefault, panelClassName);

  const modal = (
    <ResponsiveSheetContext.Provider value={contextValue}>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`relative z-10 mx-4 flex max-h-[90vh] w-full flex-col overflow-hidden shadow-2xl ${noPanelPadding ? '' : 'p-4'} ${maxWidth} ${modalPanelClass} ${className}`}
              style={panelStyle}
            >
              {!hideCloseButton && !activeHeaderActions && (
                <button
                  onClick={onClose}
                  className={`absolute z-20 p-1 text-white/50 transition-colors hover:text-white ${noPanelPadding ? 'top-4 right-4' : 'top-2 right-2'}`}
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {modalHeader && (
                <div className={`shrink-0 ${noPanelPadding ? '' : 'pt-2'}`}>{modalHeader}</div>
              )}

              <div
                ref={scrollContainerRef}
                className="scrollbar-hide min-h-0 flex-1 overflow-y-auto"
              >
                <SheetContent
                  hasHeader={!!modalHeader}
                  pages={pages}
                  currentPage={currentPage}
                  canGoBack={canGoBack}
                  onBack={goBack}
                  mode={mode}
                />
              </div>

              {/* Overflow cue — blur mask at the edges + a chip. */}
              <ScrollHint containerRef={scrollContainerRef} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ResponsiveSheetContext.Provider>
  );

  // Always portal the modal so an ancestor with `backdrop-filter`, `transform`,
  // `filter`, or `perspective` can't capture our `position: fixed` — the
  // header has `backdrop-blur-xl`, which would otherwise scope us to its box.
  // `usePortalContainer` (e.g. shadow DOM widgets) takes priority when set;
  // otherwise we land on document.body. SSR-safe via the mounted gate.
  if (!mounted) return null;
  const target = portalContainer ?? document.body;
  return createPortal(modal, target);
}

const KEBAB_TONE_CLASSES: Record<
  NonNullable<SheetPageKebabItem['tone']>,
  { text: string; selectedBg: string; iconText: string }
> = {
  primary: {
    text: 'text-primary',
    selectedBg: 'bg-primary/10',
    iconText: 'text-primary',
  },
  amber: {
    text: 'text-amber-700 dark:text-amber-300',
    selectedBg: 'bg-amber-100 dark:bg-amber-950/40',
    iconText: 'text-amber-700 dark:text-amber-300',
  },
  red: {
    text: 'text-red-700 dark:text-red-300',
    selectedBg: 'bg-red-100 dark:bg-red-950/40',
    iconText: 'text-red-700 dark:text-red-300',
  },
};

export function KebabActionsPageContent({
  items,
  onSelected,
}: {
  items: SheetPageKebabItem[];
  onSelected: () => void;
}) {
  type Group = { section?: string; items: SheetPageKebabItem[] };
  const groups: Group[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {groups.map((group, gi) => (
        <div key={gi} className="bg-card overflow-hidden border">
          {group.section && (
            <div className="text-muted-foreground/70 bg-muted/30 border-b px-4 py-2 text-[10px] font-semibold tracking-widest uppercase">
              {group.section}
            </div>
          )}
          {group.items.map((item) => {
            const Icon = item.icon;
            const tone = item.tone ? KEBAB_TONE_CLASSES[item.tone] : null;
            const isDestructive = item.variant === 'destructive';
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onSelect();
                  onSelected();
                }}
                className={cn(
                  'flex w-full items-center gap-3 border-b px-4 py-4 text-left transition-colors last:border-b-0',
                  'active:scale-[0.995]',
                  item.selected ? 'font-semibold' : 'font-medium',
                  tone
                    ? cn(tone.text, item.selected && tone.selectedBg, 'hover:bg-muted/40')
                    : isDestructive
                      ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20'
                      : 'text-foreground hover:bg-muted/40',
                  item.selected && !tone && !isDestructive && 'bg-muted/40'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    tone
                      ? tone.iconText
                      : isDestructive
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                  )}
                />
                <span className="flex-1 text-sm">{item.label}</span>
                {item.selected && (
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0 opacity-70',
                      tone ? tone.iconText : 'text-muted-foreground'
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export type { ResponsiveSheetProps, ResponsiveSheetContextValue, SheetMode };
