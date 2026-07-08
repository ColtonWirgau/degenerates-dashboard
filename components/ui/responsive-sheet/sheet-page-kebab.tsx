'use client';

import { useContext } from 'react';
import { Check, MoreHorizontal, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ResponsiveSheetContext } from './responsive-sheet-context';

export interface SheetPageKebabItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  variant?: 'default' | 'destructive';
  section?: string;
  selected?: boolean;
  tone?: 'primary' | 'amber' | 'red';
}

const TONE_CLASSES: Record<
  NonNullable<SheetPageKebabItem['tone']>,
  { text: string; selectedBg: string; focusBg: string; focusText: string }
> = {
  primary: {
    text: 'text-primary',
    selectedBg: 'bg-primary/15',
    focusBg: 'focus:bg-primary/10',
    focusText: 'focus:text-primary',
  },
  amber: {
    text: 'text-amber-700 dark:text-amber-300',
    selectedBg: 'bg-amber-100 dark:bg-amber-950/40',
    focusBg: 'focus:bg-amber-50 dark:focus:bg-amber-950/30',
    focusText: 'focus:text-amber-700 dark:focus:text-amber-300',
  },
  red: {
    text: 'text-red-700 dark:text-red-300',
    selectedBg: 'bg-red-100 dark:bg-red-950/40',
    focusBg: 'focus:bg-red-50 dark:focus:bg-red-950/30',
    focusText: 'focus:text-red-700 dark:focus:text-red-300',
  },
};

const TRIGGER_CLASS =
  'rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none';

export function SheetPageKebab({
  items,
  forceMenu = false,
}: {
  items: SheetPageKebabItem[];
  forceMenu?: boolean;
}) {
  const sheetCtx = useContext(ResponsiveSheetContext);
  const isInSheetMode = sheetCtx?.mode === 'sheet';

  if (items.length === 0) return null;

  if (items.length === 1 && !forceMenu) {
    const only = items[0];
    const Icon = only.icon;
    return (
      <button
        type="button"
        aria-label={only.label}
        onClick={only.onSelect}
        className={TRIGGER_CLASS}
      >
        <Icon className="h-5 w-5" />
      </button>
    );
  }

  if (isInSheetMode && sheetCtx) {
    return (
      <button
        type="button"
        aria-label="Page actions"
        onClick={() => sheetCtx.pushKebabPage(items)}
        className={TRIGGER_CLASS}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Page actions" className={TRIGGER_CLASS}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="min-w-[12rem] rounded-none border p-0 shadow-lg"
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const prevSection = index === 0 ? undefined : items[index - 1].section;
          const showSectionHeader = item.section !== undefined && item.section !== prevSection;
          const tone = item.tone ? TONE_CLASSES[item.tone] : null;
          const isDestructive = item.variant === 'destructive';
          return (
            <div key={item.key}>
              {showSectionHeader && (
                <DropdownMenuLabel
                  className={cn(
                    'text-muted-foreground/70 bg-muted/30 border-b px-4 py-1.5 text-[10px] font-semibold tracking-widest uppercase',
                    index > 0 && 'border-t'
                  )}
                >
                  {item.section}
                </DropdownMenuLabel>
              )}
              <DropdownMenuItem
                onSelect={item.onSelect}
                className={cn(
                  'cursor-pointer rounded-none border-b px-4 py-3 text-sm transition-colors last:border-b-0',
                  item.selected ? 'font-semibold' : 'font-medium',
                  tone
                    ? cn(tone.text, tone.focusBg, tone.focusText)
                    : isDestructive
                      ? 'text-red-600 focus:bg-red-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-950/30 dark:focus:text-red-400'
                      : 'text-foreground focus:bg-muted/50 focus:text-foreground',
                  item.selected && tone && tone.selectedBg,
                  item.selected && !tone && !isDestructive && 'bg-muted/40'
                )}
              >
                <Icon
                  className={cn(
                    'mr-3 h-4 w-4',
                    tone
                      ? tone.text
                      : isDestructive
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.selected && (
                  <Check
                    className={cn(
                      'ml-2 h-4 w-4 opacity-70',
                      tone ? tone.text : 'text-muted-foreground'
                    )}
                  />
                )}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
