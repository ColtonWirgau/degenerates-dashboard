'use client';

import { createContext, useContext, Children, isValidElement, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

const SheetNavigatorContext = createContext<{
  currentPage: string;
  navigate: (page: string) => void;
  goBack: () => void;
  canGoBack: boolean;
} | null>(null);

export function useSheetNavigator() {
  const context = useContext(SheetNavigatorContext);
  if (!context) {
    throw new Error('useSheetNavigator must be used within a SheetNavigator');
  }
  return context;
}

interface SheetNavigatorProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
  canGoBack?: boolean;
  children: ReactNode;
  className?: string;
}

export interface SheetPageProps {
  /** Unique name/key for this page */
  name: string;
  /** Optional title shown in the back-bar when this page is active. */
  title?: ReactNode;
  /**
   * Optional gradient/panel header rendered at the top of the sheet while
   * this page is active — overrides the sheet-level `header` prop so each
   * drilled-in page can carry its own hierarchy (kicker + title).
   */
  header?: ReactNode;
  /**
   * Optional actions rendered in the top-right of the sheet panel while this
   * page is active (replaces the default close button when provided).
   */
  headerActions?: ReactNode;
  /** Right-side content rendered on the back-bar row. */
  backBarTrailing?: ReactNode;
  children: ReactNode;
}

export function SheetPage({ children }: SheetPageProps) {
  return <>{children}</>;
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

export function SheetNavigator({
  currentPage,
  onNavigate,
  onBack,
  canGoBack = false,
  children,
  className = '',
}: SheetNavigatorProps) {
  const pages: { name: string; title?: ReactNode; content: ReactNode }[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === SheetPage) {
      const { name, title, children: pageChildren } = child.props as SheetPageProps;
      pages.push({ name, title, content: pageChildren });
    }
  });

  const activePage = pages.find((p) => p.name === currentPage);
  const direction = currentPage === 'main' ? -1 : 1;

  return (
    <SheetNavigatorContext.Provider
      value={{ currentPage, navigate: onNavigate, goBack: onBack, canGoBack }}
    >
      <div className={`relative overflow-hidden ${className}`}>
        <AnimatePresence>
          {canGoBack && activePage?.title && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-4 flex items-center gap-2 px-6"
            >
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <span className="text-white/30">|</span>
              <span className="text-sm font-semibold tracking-wide text-white uppercase">
                {activePage.title}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" custom={direction}>
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
    </SheetNavigatorContext.Provider>
  );
}

export type { SheetNavigatorProps };
