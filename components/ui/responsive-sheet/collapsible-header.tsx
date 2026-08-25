import type { ReactNode } from 'react';

export interface CollapsibleHeaderProps {
  /** How small the header shrinks: 0.5 = 50% of original height (default: 0.5) */
  ratio?: number;
  /** Optional background layer behind the shrinking content (e.g. blurred image) */
  background?: ReactNode;
  /** Sharp content that scales down on scroll */
  children: ReactNode;
}

/**
 * Marker component that signals to ResponsiveSheet that the header should
 * collapse on scroll. This component never renders — ResponsiveSheet detects
 * it via `__isCollapsibleHeader` and reads its props to set up the collapse
 * behavior internally.
 */
export function CollapsibleHeader(): null {
  return null;
}

CollapsibleHeader.__isCollapsibleHeader = true as const;
