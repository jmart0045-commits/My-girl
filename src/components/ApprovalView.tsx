import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ShieldAlert, XCircle } from 'lucide-react';
import type { AuditItem } from '../types';

interface ApprovalViewProps {
  audits: AuditItem[];
  loading: boolean;
  onExecuteAction: (
    action: string,
    payload: string,
    approved: boolean
  ) => Promise<{ ok: boolean; message: string }>;
  compact?: boolean;
}

const PRESET_ACTIONS = [
  {
    action: 'create_task',
    label: 'Create Task',
    defaultPayload: 'Review weekly goals on Friday 5 PM',
  },
  {
    action: 'save_memory',
    label: 'Save Memory',
    defaultPayload: 'Prefers concise Burmese summaries',
  },
  {
    action: 'draft_message',
    label: 'Draft Message',
    defaultPayload: 'မင်္ဂလာပါခင်ဗျာ၊ မနက်ဖြန် Meeting အချိန်ကို ၁၀ နာရီသို့ ရွှေ့ဆိုင်းလိုပါတယ်။',
  },
  {
    action: 'device_navigation',
    label: 'Phone Accessibility',
    defaultPayload: 'GLOBAL_ACTION_HOME',
  },
];

export function ApprovalView({
  audits,
  loading,
  onExecuteAction,
  compact = false,
}: ApprovalViewProps) {
  const [actionName, setActionName] = useState('draft_message');
  const [payload, setPayload] = useState(
    'မင်္ဂလာပါခင်ဗျာ၊ မနက်ဖြန် Meeting အချိန်ကို ၁၀ နာရီသို့ ရွှေ့ဆိုင်းလိုပါတယ်။'
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  const handleDispatch = async (approved: boolean) => {
    if (!actionName.trim() || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await onExecuteAction(actionName.trim(), payload, approved);
      setFeedback(res);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`h-full min-h-0 overflow-y-auto ${compact ? 'p-4' : 'px-4 sm:px-8 py-6'}`}>
      <div className={`${compact ? 'space-y-4' : 'mx-auto max-w-4xl space-y-6'}`}>
        <div className="rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#070B16]/80 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="font-display text-xs sm:text-sm font-semibold text-slate-900 dark:text-cyan-100">
                Action Approval Gate
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Unapproved requests return HTTP 403 and log to the audit trail.
              </p>
            </div>
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESET_ACTIONS.map((preset) => (
              <button
                key={preset.action}
                type="button"
                onClick={() => {
                  setActionName(preset.action);
                  setPayload(preset.defaultPayload);
                  setFeedback(null);
                }}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  actionName === preset.action
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-sky-900 dark:text-cyan-100'
                    : 'border-slate-200 dark:border-cyan-500/20 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-cyan-500/10'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <input
              type="text"
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              aria-label="Action key"
              placeholder="Action key"
              className="w-full rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-slate-50 dark:bg-[#0B1224] px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              type="text"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              aria-label="Action payload"
              placeholder="Action payload"
              className="w-full rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-slate-50 dark:bg-[#0B1224] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={submitting || !actionName.trim()}
              onClick={() => handleDispatch(true)}
              className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50"
            >
              Approve & Execute
            </button>
            <button
              type="button"
              disabled={submitting || !actionName.trim()}
              onClick={() => handleDispatch(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Test Reject (403)
            </button>
          </div>

          {feedback && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
                feedback.ok
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/35 dark:bg-amber-950/30 dark:text-amber-200'
              }`}
            >
              {feedback.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-cyan-500/15 bg-white dark:bg-[#070B16]/80 overflow-hidden">
          <div className="border-b border-slate-200 dark:border-cyan-500/15 px-4 py-2.5 flex items-center justify-between">
            <span className="font-display text-xs font-semibold text-slate-900 dark:text-cyan-100">
              Real-Time Audit Log
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-cyan-300/75">
              {audits.length} events
            </span>
          </div>

          {loading ? (
            <div className="p-3 space-y-2">
              <div className="h-8 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
              <div className="h-8 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
            </div>
          ) : audits.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No action executions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-cyan-500/10">
              {audits.map((row) => (
                <div
                  key={row.id}
                  className="px-4 py-2.5 text-xs space-y-1 hover:bg-slate-50/60 dark:hover:bg-cyan-500/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-900 dark:text-cyan-200 font-medium">
                      {row.action}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {row.approved === 1 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </span>
                      )}
                      <span className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                        {row.created_at}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {row.outcome}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!compact && (
          <div className="rounded-lg border border-slate-200 dark:border-cyan-500/15 bg-white dark:bg-[#070B16]/80">
            <button
              type="button"
              onClick={() => setShowAndroidGuide(!showAndroidGuide)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-cyan-200 hover:bg-slate-50 dark:hover:bg-cyan-500/5 transition-colors"
            >
              <span>Android Companion API Endpoints</span>
              {showAndroidGuide ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {showAndroidGuide && (
              <div className="border-t border-slate-200 dark:border-cyan-500/15 px-4 py-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <p>
                  This backend implements the API routes used by your Android Studio starter app:
                </p>
                <div className="font-mono text-[11px] bg-slate-50 dark:bg-[#0B1224] rounded-md p-3 border border-slate-200 dark:border-cyan-500/15 space-y-1 text-slate-800 dark:text-cyan-100">
                  <div>GET /health</div>
                  <div>POST /api/chat</div>
                  <div>GET, POST, DELETE /api/memory/default</div>
                  <div>GET, POST, PATCH, DELETE /api/tasks/default</div>
                  <div>POST /api/actions/execute</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
