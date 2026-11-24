import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { MemoryItem } from '../types';

interface MemoryViewProps {
  items: MemoryItem[];
  loading: boolean;
  onAdd: (content: string, category: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClearAll: () => Promise<void>;
  showAddForm: boolean;
  onToggleAddForm: (open: boolean) => void;
  compact?: boolean;
}

const CATEGORIES = ['all', 'personal', 'preference', 'note'] as const;

export function MemoryView({
  items,
  loading,
  onAdd,
  onDelete,
  onClearAll,
  showAddForm,
  onToggleAddForm,
  compact = false,
}: MemoryViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORIES)[number]>('all');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('note');
  const [submitting, setSubmitting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const catMatch =
        categoryFilter === 'all' || item.category.toLowerCase() === categoryFilter;
      const textMatch = !q || item.content.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [items, search, categoryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newContent.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(content, newCategory);
      setNewContent('');
      onToggleAddForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`h-full min-h-0 overflow-y-auto ${compact ? 'p-4' : 'px-4 sm:px-8 py-6'}`}>
      <div className={`${compact ? 'space-y-4' : 'mx-auto max-w-4xl space-y-6'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memories…"
              className="w-full rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16] pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-[#0D162B] border border-slate-200 dark:border-cyan-500/15 p-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-cyan-500/20 dark:text-cyan-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {items.length > 0 && !confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="rounded-lg border border-slate-200 dark:border-rose-500/30 bg-white dark:bg-[#0D162B] px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors whitespace-nowrap shrink-0"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {confirmClear && (
          <div className="rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-rose-900 dark:text-rose-200">
              Delete all {items.length} saved memories permanently?
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await onClearAll();
                  setConfirmClear(false);
                }}
                className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D162B] px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showAddForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-slate-200 dark:border-cyan-500/25 bg-slate-50/70 dark:bg-[#0D162B] p-3.5 space-y-2.5"
          >
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              placeholder="e.g., My favorite coffee is iced Americano / ကျွန်တော် မနက် ၇ နာရီ အိပ်ရာထတယ်"
              className="w-full rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16] px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <div className="flex items-center justify-between gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                aria-label="Memory category"
                className="rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16] px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="note">Note</option>
                <option value="personal">Personal</option>
                <option value="preference">Preference</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleAddForm(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newContent.trim()}
                  className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-1 text-xs font-semibold text-white dark:text-slate-950 disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="rounded-lg border border-slate-200 dark:border-cyan-500/15 bg-white dark:bg-[#070B16]/75 divide-y divide-slate-200 dark:divide-cyan-500/10">
          {loading ? (
            <div className="p-3 space-y-2">
              <div className="h-9 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
              <div className="h-9 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center space-y-3">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                {items.length === 0
                  ? 'No memories saved yet. Say “remember this” or add a note.'
                  : 'No memories match the current filter.'}
              </p>
              {items.length === 0 && (
                <button
                  type="button"
                  onClick={() => onToggleAddForm(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-slate-950"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Memory
                </button>
              )}
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-cyan-500/5 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed break-words">
                    {item.content}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="capitalize">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-mono">{item.created_at}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label="Delete memory"
                  className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
