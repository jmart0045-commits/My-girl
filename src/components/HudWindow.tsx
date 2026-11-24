import type { ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface HudWindowProps {
  title: string;
  subtitle?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function HudWindow({
  title,
  subtitle,
  expanded = false,
  onToggleExpand,
  headerRight,
  children,
  className = '',
}: HudWindowProps) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-200 bg-white/95 dark:border-cyan-500/20 dark:bg-[#090F1E]/85 backdrop-blur-md shadow-xs dark:shadow-[0_0_28px_rgba(14,165,233,0.06)] overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-cyan-500/15 bg-slate-50/80 dark:bg-[#0D1529]/90 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-display text-xs font-semibold tracking-wide text-slate-800 dark:text-cyan-100 truncate">
            {title}
          </h2>
          {subtitle && (
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-cyan-400/70 truncate">
              · {subtitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={expanded ? `Restore ${title}` : `Expand ${title}`}
              title={expanded ? 'Back to Workstation' : 'Expand Panel'}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-cyan-300/70 dark:hover:bg-cyan-500/15 dark:hover:text-cyan-200 transition-colors"
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </section>
  );
}
