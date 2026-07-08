'use client';

import { createContext } from 'react';
import type { SheetPageKebabItem } from './sheet-page-kebab';

export type SheetMode = 'modal' | 'sheet';

export interface ResponsiveSheetContextValue {
  /** Current display mode - 'modal' on desktop, 'sheet' on mobile */
  mode: SheetMode;
  /** The user's resolved theme ('light' or 'dark'). This app is dark-only. */
  resolvedTheme: string | undefined;
  /** Navigate to a specific page */
  navigate: (page: string) => void;
  /** Go back to the previous page */
  goBack: () => void;
  /** Current page name */
  currentPage: string;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /**
   * Push the synthetic actions page onto the sheet stack. Used by
   * `SheetPageKebab` in mobile sheet mode to drill into a row-style
   * action picker instead of opening a Radix dropdown over the sheet.
   */
  pushKebabPage: (items: SheetPageKebabItem[], title?: string) => void;
}

export const ResponsiveSheetContext = createContext<ResponsiveSheetContextValue | null>(null);
