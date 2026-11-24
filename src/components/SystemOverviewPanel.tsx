interface RingMetricProps {
  label: string;
  value: string;
  sublabel: string;
  percent: number;
  strokeClass: string;
}

function RingMetric({ label, value, sublabel, percent, strokeClass }: RingMetricProps) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative h-16 w-16 flex items-center justify-center">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 60 60" aria-hidden="true">
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-slate-200 dark:text-slate-800"
          />
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={strokeClass}
          />
        </svg>
        <span className="absolute font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {value}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
        {label}
      </div>
      <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
        {sublabel}
      </div>
    </div>
  );
}

interface SystemOverviewPanelProps {
  memoryCount: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  approvedAuditCount: number;
  totalAuditCount: number;
}

export function SystemOverviewPanel({
  memoryCount,
  pendingTaskCount,
  completedTaskCount,
  approvedAuditCount,
  totalAuditCount,
}: SystemOverviewPanelProps) {
  const totalTasks = pendingTaskCount + completedTaskCount;
  const taskCompletionPct = totalTasks > 0 ? Math.round((completedTaskCount / totalTasks) * 100) : 0;
  const memoryPct = Math.min(100, Math.round((memoryCount / 20) * 100));
  const pendingPct = totalTasks > 0 ? Math.round((pendingTaskCount / totalTasks) * 100) : 0;
  const approvalPct =
    totalAuditCount > 0 ? Math.round((approvedAuditCount / totalAuditCount) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-4">
      <RingMetric
        label="Memories"
        value={String(memoryCount)}
        sublabel="saved notes"
        percent={memoryPct}
        strokeClass="text-sky-500 dark:text-cyan-400"
      />
      <RingMetric
        label="Pending"
        value={String(pendingTaskCount)}
        sublabel={`of ${totalTasks} tasks`}
        percent={pendingPct}
        strokeClass="text-amber-500 dark:text-amber-400"
      />
      <RingMetric
        label="Done Rate"
        value={`${taskCompletionPct}%`}
        sublabel={`${completedTaskCount} done`}
        percent={taskCompletionPct}
        strokeClass="text-emerald-500 dark:text-emerald-400"
      />
      <RingMetric
        label="Approved"
        value={`${approvedAuditCount}`}
        sublabel={`of ${totalAuditCount} gates`}
        percent={approvalPct}
        strokeClass="text-indigo-500 dark:text-indigo-400"
      />
    </div>
  );
}
