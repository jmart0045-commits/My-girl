import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { TaskCategory, TaskItem } from '../types';

interface TasksViewProps {
  items: TaskItem[];
  loading: boolean;
  onAdd: (title: string, runAt: string | null, category: TaskCategory) => Promise<void>;
  onToggleStatus: (task: TaskItem) => Promise<void>;
  onChangeCategory: (task: TaskItem, category: TaskCategory) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  showAddForm: boolean;
  onToggleAddForm: (open: boolean) => void;
  compact?: boolean;
}

type TaskFilter = 'all' | 'PENDING' | 'DONE';
type CategoryFilter = 'all' | TaskCategory;
type TaskSort = 'due_date' | 'alphabetical';

const CATEGORY_META: Record<
  TaskCategory,
  { label: string; dotClass: string; tagClass: string }
> = {
  personal: {
    label: 'Personal',
    dotClass: 'bg-indigo-500 dark:bg-indigo-400',
    tagClass:
      'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-200',
  },
  work: {
    label: 'Work',
    dotClass: 'bg-sky-500 dark:bg-cyan-400',
    tagClass:
      'border-sky-200 bg-sky-50 text-sky-800 dark:border-cyan-500/35 dark:bg-cyan-500/15 dark:text-cyan-200',
  },
  urgent: {
    label: 'Urgent',
    dotClass: 'bg-rose-500 dark:bg-rose-400',
    tagClass:
      'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200',
  },
  general: {
    label: 'General',
    dotClass: 'bg-slate-400 dark:bg-slate-400',
    tagClass:
      'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
  },
};

const CATEGORY_OPTIONS: TaskCategory[] = ['personal', 'work', 'urgent', 'general'];

function isTaskOverdue(task: TaskItem): boolean {
  if (task.status === 'DONE' || !task.run_at) return false;
  const due = new Date(task.run_at);
  return !Number.isNaN(due.getTime()) && due.getTime() <= Date.now();
}

export function TasksView({
  items,
  loading,
  onAdd,
  onToggleStatus,
  onChangeCategory,
  onDelete,
  showAddForm,
  onToggleAddForm,
  compact = false,
}: TasksViewProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortBy, setSortBy] = useState<TaskSort>('due_date');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [runAt, setRunAt] = useState('');
  const [newCategory, setNewCategory] = useState<TaskCategory>('personal');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = items.filter((item) => {
      const statusMatch = filter === 'all' || item.status === filter;
      const itemCategory = (item.category || 'general') as TaskCategory;
      const catMatch = categoryFilter === 'all' || itemCategory === categoryFilter;
      const titleMatch = !q || item.title.toLowerCase().includes(q);
      return statusMatch && catMatch && titleMatch;
    });

    return [...matched].sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      if (a.status !== b.status) {
        return a.status === 'PENDING' ? -1 : 1;
      }
      const aTime = a.run_at ? new Date(a.run_at).getTime() : Number.NaN;
      const bTime = b.run_at ? new Date(b.run_at).getTime() : Number.NaN;
      const aHasDue = !Number.isNaN(aTime);
      const bHasDue = !Number.isNaN(bTime);
      if (aHasDue && bHasDue) return aTime - bTime;
      if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;
      return b.id - a.id;
    });
  }, [items, filter, categoryFilter, search, sortBy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed, runAt.trim() ? runAt.trim() : null, newCategory);
      setTitle('');
      setRunAt('');
      onToggleAddForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`h-full min-h-0 overflow-y-auto ${compact ? 'p-4' : 'px-4 sm:px-8 py-6'}`}>
      <div className={`${compact ? 'space-y-3.5' : 'mx-auto max-w-4xl space-y-5'}`}>
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks by title"
                className="w-full rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16] pl-8 pr-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-[#0D162B] border border-slate-200 dark:border-cyan-500/15 p-0.5">
                {(['all', 'PENDING', 'DONE'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      filter === tab
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-cyan-500/20 dark:text-cyan-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'PENDING' ? 'Pending' : 'Done'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onToggleAddForm(!showAddForm)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-cyan-500 px-3 py-1.5 text-[11px] font-semibold text-white dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-cyan-400/60 dark:bg-cyan-500/20 dark:text-cyan-100'
                    : 'border-slate-200 dark:border-cyan-500/15 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-cyan-100'
                }`}
              >
                All Categories
              </button>
              {CATEGORY_OPTIONS.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? meta.tagClass
                        : 'border-slate-200 dark:border-cyan-500/15 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-cyan-100'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} aria-hidden="true" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <ArrowUpDown className="h-3 w-3" />
                <span>Sort</span>
              </span>
              <div
                role="group"
                aria-label="Sort tasks"
                className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-[#0D162B] border border-slate-200 dark:border-cyan-500/15 p-0.5"
              >
                <button
                  type="button"
                  onClick={() => setSortBy('due_date')}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    sortBy === 'due_date'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-cyan-500/20 dark:text-cyan-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
                  }`}
                >
                  Due Date
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('alphabetical')}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    sortBy === 'alphabetical'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-cyan-500/20 dark:text-cyan-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
                  }`}
                >
                  A–Z
                </button>
              </div>
            </div>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-slate-200 dark:border-cyan-500/25 bg-slate-50/70 dark:bg-[#0D162B] p-3.5 space-y-2.5"
          >
            <div className="grid grid-cols-1 gap-2.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task description (e.g., Call client at 10 AM)"
                className="rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16] px-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                  aria-label="Task category"
                  className="rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={runAt}
                  onChange={(e) => setRunAt(e.target.value)}
                  aria-label="Scheduled date and time"
                  className="rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16] px-3 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onToggleAddForm(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-1 text-xs font-semibold text-white dark:text-slate-950 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Create'}
              </button>
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
                  ? 'No scheduled tasks yet.'
                  : 'No tasks match this filter.'}
              </p>
              {items.length === 0 && (
                <button
                  type="button"
                  onClick={() => onToggleAddForm(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-slate-950"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Task
                </button>
              )}
            </div>
          ) : (
            filtered.map((task) => {
              const done = task.status === 'DONE';
              const overdue = isTaskOverdue(task);
              const catKey: TaskCategory =
                task.category && task.category in CATEGORY_META ? task.category : 'general';
              const catMeta = CATEGORY_META[catKey];

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-cyan-500/5 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(task)}
                      aria-label={done ? 'Mark task pending' : 'Mark task completed'}
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border transition-colors shrink-0 ${
                        done
                          ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                          : 'border-slate-300 dark:border-cyan-500/40 hover:border-cyan-400'
                      }`}
                    >
                      {done && <Check className="h-3 w-3" />}
                    </button>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs sm:text-sm font-medium break-words ${
                            done
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${catMeta.tagClass}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${catMeta.dotClass}`}
                            aria-hidden="true"
                          />
                          <span>{catMeta.label}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        {done ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Done
                          </span>
                        ) : overdue ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Due now
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                        {task.run_at && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <CalendarClock className="h-3 w-3" />
                              {task.run_at.replace('T', ' ')}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <select
                          value={catKey}
                          onChange={(e) =>
                            onChangeCategory(task, e.target.value as TaskCategory)
                          }
                          aria-label={`Change category for ${task.title}`}
                          className="bg-transparent text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-cyan-200 focus:outline-none cursor-pointer"
                        >
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option
                              key={opt}
                              value={opt}
                              className="bg-white dark:bg-[#0D162B] text-slate-900 dark:text-slate-100"
                            >
                              {CATEGORY_META[opt].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(task.id)}
                    aria-label="Delete task"
                    className="rounded-md p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
