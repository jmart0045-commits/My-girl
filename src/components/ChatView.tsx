import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Mic,
  MicOff,
  Plus,
  Send,
  ShieldAlert,
  Volume2,
  XCircle,
} from 'lucide-react';
import type { ChatMessage, ProposedAction, SuggestedTask, VoiceLanguage } from '../types';

interface ChatViewProps {
  messages: ChatMessage[];
  loadingHistory: boolean;
  sending: boolean;
  error: string | null;
  draft: string;
  onChangeDraft: (val: string) => void;
  onSend: (text?: string) => void;
  onSpeak: (text: string) => void;
  dictating: boolean;
  onToggleDictation: () => void;
  speechSupported: boolean;
  wakeActive: boolean;
  wakeNotice: string | null;
  onDismissWakeNotice: () => void;
  language: VoiceLanguage;
  onSaveSuggestedTask: (messageId: string, task: SuggestedTask) => Promise<void>;
  onDecideProposedAction: (
    messageId: string,
    proposal: ProposedAction,
    approved: boolean
  ) => Promise<void>;
  compact?: boolean;
}

const STARTER_PROMPTS = [
  {
    label: 'မင်္ဂလာပါ My Girl၊ ဒီနေ့ ဘာကူညီပေးနိုင်လဲ',
    tag: 'Burmese Greeting',
  },
  {
    label: 'Remember this: I prefer morning briefings at 8:30 AM',
    tag: 'Memory',
  },
  {
    label: 'မနက်ဖြန် မနက် ၉ နာရီ Team Sync သတိပေးပါ',
    tag: 'Task Scheduler',
  },
  {
    label: 'Draft a polite email to reschedule tomorrow afternoon’s meeting',
    tag: 'Approval Gate',
  },
];

function formatTime(iso: string): string {
  const date = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatView({
  messages,
  loadingHistory,
  sending,
  error,
  draft,
  onChangeDraft,
  onSend,
  onSpeak,
  dictating,
  onToggleDictation,
  speechSupported,
  wakeActive,
  wakeNotice,
  onDismissWakeNotice,
  language,
  onSaveSuggestedTask,
  onDecideProposedAction,
  compact = false,
}: ChatViewProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(wakeActive || wakeNotice) && (
        <div className="border-b border-slate-200 dark:border-cyan-500/20 bg-sky-50/70 dark:bg-cyan-950/30 px-4 py-2 flex items-center justify-between gap-4 text-xs shrink-0">
          <div className="text-sky-900 dark:text-cyan-200">
            {wakeNotice
              ? wakeNotice
              : 'Wake listener active — say “My Girl” to trigger voice recognition.'}
          </div>
          {wakeNotice && (
            <button
              type="button"
              onClick={onDismissWakeNotice}
              className="text-sky-700 dark:text-cyan-300 underline hover:no-underline whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto ${compact ? 'px-4 py-4' : 'px-4 sm:px-8 py-6'}`}>
        <div className={`${compact ? 'space-y-4' : 'mx-auto max-w-3xl space-y-6'}`}>
          {loadingHistory ? (
            <div className="space-y-3">
              <div className="h-14 w-3/4 rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
              <div className="ml-auto h-10 w-1/2 rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
            </div>
          ) : messages.length === 0 ? (
            <div className={compact ? 'space-y-4 py-2' : 'py-8 space-y-6'}>
              <div className="space-y-1.5">
                <h3 className="font-display text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-cyan-50 text-balance">
                  မင်္ဂလာပါ — Ask My Girl in Burmese or English
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Plan tasks, store facts in Memory Vault, dictate by voice, and approve actions safely.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onSend(item.label)}
                    className="text-left rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#0D162B] p-3 hover:border-sky-400 dark:hover:border-cyan-400/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <div className="text-[11px] font-mono text-slate-500 dark:text-cyan-400/80 mb-1">
                      {item.tag}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                      {item.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-slate-900 text-white dark:bg-gradient-to-r dark:from-cyan-600 dark:to-indigo-600 dark:text-white'
                        : 'bg-slate-50 text-slate-900 border border-slate-200 dark:bg-[#0D162B] dark:text-slate-100 dark:border-cyan-500/20'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  </div>

                  <div className="mt-1 flex items-center gap-3 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums font-mono">{formatTime(msg.created_at)}</span>
                    {!isUser && (
                      <>
                        <button
                          type="button"
                          onClick={() => onSpeak(msg.content)}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-cyan-300 transition-colors"
                        >
                          <Volume2 className="h-3 w-3" />
                          <span>Speak</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-cyan-300 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  {msg.savedMemory && (
                    <div className="mt-1.5 max-w-[88%] rounded-lg border border-slate-200 dark:border-cyan-500/20 bg-slate-50 dark:bg-[#0B1426] px-3 py-2 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>
                        Saved to Memory Vault:{' '}
                        <strong className="font-medium">{msg.savedMemory.content}</strong>
                      </span>
                    </div>
                  )}

                  {msg.suggestedTask && (
                    <div className="mt-1.5 max-w-[88%] rounded-lg border border-slate-200 dark:border-cyan-500/25 bg-white dark:bg-[#0D162B] px-3.5 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500 dark:text-cyan-300/80 capitalize">
                          Suggested Task
                          {msg.suggestedTask.category && msg.suggestedTask.category !== 'general'
                            ? ` · ${msg.suggestedTask.category}`
                            : ''}
                          {msg.suggestedTask.runAt ? ` · ${msg.suggestedTask.runAt}` : ''}
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {msg.suggestedTask.title}
                        </div>
                      </div>
                      {msg.taskSaved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyActionId === `task-${msg.id}`}
                          onClick={async () => {
                            if (!msg.suggestedTask) return;
                            setBusyActionId(`task-${msg.id}`);
                            try {
                              await onSaveSuggestedTask(msg.id, msg.suggestedTask);
                            } finally {
                              setBusyActionId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white dark:text-slate-950 hover:opacity-90 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Save Task
                        </button>
                      )}
                    </div>
                  )}

                  {msg.proposedAction && (
                    <div className="mt-1.5 w-full max-w-[88%] rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/25 px-3.5 py-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] font-mono text-amber-900 dark:text-amber-300">
                            Approval Required · {msg.proposedAction.action}
                          </div>
                          <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                            {msg.proposedAction.summary}
                          </div>
                        </div>
                      </div>

                      {msg.proposedAction.payload && (
                        <pre className="rounded-md border border-amber-200 dark:border-amber-500/25 bg-white dark:bg-[#070B16] p-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                          {msg.proposedAction.payload}
                        </pre>
                      )}

                      {msg.actionDecision ? (
                        <div className="flex items-center gap-2 text-xs font-medium">
                          {msg.actionDecision === 'approved' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-500" />
                          )}
                          <span className="text-slate-700 dark:text-slate-300">
                            {msg.actionOutcome}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busyActionId === `act-${msg.id}`}
                            onClick={async () => {
                              if (!msg.proposedAction) return;
                              setBusyActionId(`act-${msg.id}`);
                              try {
                                await onDecideProposedAction(msg.id, msg.proposedAction, true);
                              } finally {
                                setBusyActionId(null);
                              }
                            }}
                            className="rounded-lg bg-slate-900 dark:bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white dark:text-slate-950 hover:opacity-90 whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            Approve & Execute
                          </button>
                          <button
                            type="button"
                            disabled={busyActionId === `act-${msg.id}`}
                            onClick={async () => {
                              if (!msg.proposedAction) return;
                              setBusyActionId(`act-${msg.id}`);
                              try {
                                await onDecideProposedAction(msg.id, msg.proposedAction, false);
                              } finally {
                                setBusyActionId(null);
                              }
                            }}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0D162B] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex items-start">
              <div className="rounded-xl border border-slate-200 dark:border-cyan-500/20 bg-slate-50 dark:bg-[#0D162B] px-3.5 py-2.5 text-xs sm:text-sm text-slate-500 dark:text-cyan-300/80">
                စဉ်းစားနေပါတယ်…
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200">
              {error}
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-cyan-500/15 bg-slate-50/70 dark:bg-[#0B1224]/90 p-3 shrink-0">
        <div className={compact ? '' : 'mx-auto max-w-3xl'}>
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 dark:border-cyan-500/25 bg-white dark:bg-[#070B16] p-1.5 focus-within:border-sky-500 dark:focus-within:border-cyan-400 transition-colors">
            <textarea
              value={draft}
              onChange={(e) => onChangeDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                language === 'my-MM'
                  ? 'My Girl ကို မြန်မာလို သို့မဟုတ် အင်္ဂလိပ်လို ပြောပါ…'
                  : 'Ask My Girl anything in English or Burmese…'
              }
              className="flex-1 resize-none bg-transparent px-2.5 py-2 leading-normal min-h-[42px] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none max-h-32"
            />

            <button
              type="button"
              onClick={onToggleDictation}
              disabled={!speechSupported}
              aria-label={dictating ? 'Stop voice input' : 'Start voice input'}
              title={dictating ? 'Stop listening' : `Voice input (${language})`}
              className={`rounded-lg p-2 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40 ${
                dictating
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-cyan-300 dark:hover:bg-cyan-500/15'
              }`}
            >
              {dictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => onSend()}
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="rounded-lg bg-slate-900 dark:bg-gradient-to-r dark:from-cyan-500 dark:to-indigo-500 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:opacity-90 transition-opacity shrink-0 inline-flex items-center gap-1.5 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
