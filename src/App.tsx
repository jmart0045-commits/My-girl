import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Mic, MicOff, Moon, RotateCcw, Sun } from 'lucide-react';
import { ApprovalView } from './components/ApprovalView';
import { ChatView } from './components/ChatView';
import { HoloCore } from './components/HoloCore';
import { HudWindow } from './components/HudWindow';
import { MemoryView } from './components/MemoryView';
import { ShortcutsPanel } from './components/ShortcutsPanel';
import { SystemOverviewPanel } from './components/SystemOverviewPanel';
import { TasksView } from './components/TasksView';
import { useVoiceAgent } from './hooks/useVoiceAgent';
import type {
  ActiveSection,
  AuditItem,
  ChatMessage,
  ElevenLabsVoice,
  MemoryItem,
  ProposedAction,
  SuggestedTask,
  TaskCategory,
  TaskItem,
  VoiceEngine,
  VoiceLanguage,
} from './types';

const USER_ID = 'default';

const NAV_TABS: Array<{ id: ActiveSection; label: string }> = [
  { id: 'workstation', label: 'Workstation' },
  { id: 'chat', label: 'Chat' },
  { id: 'memory', label: 'Memory' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'approval', label: 'Approval' },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('workstation');
  const [darkMode, setDarkMode] = useState(true);

  const [language, setLanguage] = useState<VoiceLanguage>('my-MM');
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>('elevenlabs');
  const [elevenLabsConfigured, setElevenLabsConfigured] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Warm Assistant)' },
  ]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('EXAVITQu4vr4xnSDxMaL');
  const [autoSpeak, setAutoSpeak] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [dueBannerTask, setDueBannerTask] = useState<TaskItem | null>(null);
  const notifiedTaskIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [chatRes, memRes, taskRes, auditRes, ttsRes] = await Promise.all([
        fetch(`/api/chat/${USER_ID}`),
        fetch(`/api/memory/${USER_ID}`),
        fetch(`/api/tasks/${USER_ID}`),
        fetch(`/api/actions/${USER_ID}`),
        fetch('/api/tts/voices'),
      ]);
      if (chatRes.ok) {
        const data = (await chatRes.json()) as {
          items: Array<{
            id: number;
            role: 'user' | 'assistant';
            content: string;
            created_at: string;
          }>;
        };
        setMessages(
          data.items.map((item) => ({
            id: String(item.id),
            role: item.role,
            content: item.content,
            created_at: item.created_at,
          }))
        );
      }
      if (memRes.ok) {
        const data = (await memRes.json()) as { items: MemoryItem[] };
        setMemories(data.items);
      }
      if (taskRes.ok) {
        const data = (await taskRes.json()) as { items: TaskItem[] };
        setTasks(data.items);
      }
      if (auditRes.ok) {
        const data = (await auditRes.json()) as { items: AuditItem[] };
        setAudits(data.items);
      }
      if (ttsRes.ok) {
        const data = (await ttsRes.json()) as {
          configured: boolean;
          defaultVoiceId: string;
          voices: ElevenLabsVoice[];
        };
        setElevenLabsConfigured(data.configured);
        if (data.voices?.length > 0) {
          setElevenLabsVoices(data.voices);
        }
        if (data.defaultVoiceId) {
          setSelectedVoiceId(data.defaultVoiceId);
        }
        if (!data.configured) {
          setVoiceEngine('browser');
        }
      }
    } catch {
      setChatError('Unable to reach server API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleWakeDetected = useCallback(() => {
    if (activeSection !== 'workstation' && activeSection !== 'chat') {
      setActiveSection('workstation');
    }
  }, [activeSection]);

  const handleTranscript = useCallback((text: string) => {
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  }, []);

  const voice = useVoiceAgent({
    language,
    voiceEngine,
    elevenLabsVoiceId: selectedVoiceId,
    autoSpeak,
    onTranscript: handleTranscript,
    onWakeDetected: handleWakeDetected,
  });

  useEffect(() => {
    const checkDueTasks = () => {
      const now = Date.now();
      const due = tasks.find((t) => {
        if (t.status !== 'PENDING' || !t.run_at || notifiedTaskIdsRef.current.has(t.id)) {
          return false;
        }
        const dueTime = new Date(t.run_at).getTime();
        return !Number.isNaN(dueTime) && dueTime <= now;
      });
      if (due) {
        notifiedTaskIdsRef.current.add(due.id);
        setDueBannerTask(due);
        if (autoSpeak) {
          voice.speak(`သတိပေးချက်: ${due.title}`, 'my-MM');
        }
      }
    };

    checkDueTasks();
    const timer = window.setInterval(checkDueTasks, 30000);
    return () => window.clearInterval(timer);
  }, [tasks, autoSpeak, voice]);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? draft).trim();
      if (!text || sending) return;

      const tempUserId = `temp-user-${Date.now()}`;
      const optimisticUser: ChatMessage = {
        id: tempUserId,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };

      const historyPayload = messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, optimisticUser]);
      if (!overrideText) setDraft('');
      setSending(true);
      setChatError(null);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: USER_ID,
            message: text,
            history: historyPayload,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          reply?: string;
          userMessage?: { id: number; created_at: string };
          assistantMessage?: { id: number; created_at: string };
          savedMemory?: MemoryItem | null;
          suggestedTask?: SuggestedTask | null;
          proposedAction?: ProposedAction | null;
        };

        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const replyText = data.reply ?? 'No response';
        const assistantMsg: ChatMessage = {
          id: data.assistantMessage ? String(data.assistantMessage.id) : `asst-${Date.now()}`,
          role: 'assistant',
          content: replyText,
          created_at: data.assistantMessage?.created_at ?? new Date().toISOString(),
          savedMemory: data.savedMemory ?? null,
          suggestedTask: data.suggestedTask ?? null,
          proposedAction: data.proposedAction ?? null,
        };

        setMessages((prev) => [
          ...prev.map((m) =>
            m.id === tempUserId && data.userMessage
              ? { ...m, id: String(data.userMessage.id), created_at: data.userMessage.created_at }
              : m
          ),
          assistantMsg,
        ]);

        if (data.savedMemory) {
          setMemories((prev) => [data.savedMemory!, ...prev]);
        }

        if (autoSpeak) {
          voice.speak(replyText);
        }
      } catch (err) {
        setChatError(err instanceof Error ? err.message : 'Failed to connect to assistant.');
      } finally {
        setSending(false);
      }
    },
    [draft, sending, messages, autoSpeak, voice]
  );

  const handleNewChat = async () => {
    const res = await fetch(`/api/chat/${USER_ID}`, { method: 'DELETE' });
    if (res.ok) {
      setMessages([]);
      setChatError(null);
    }
  };

  const handleAddMemory = async (content: string, category: string) => {
    const res = await fetch(`/api/memory/${USER_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, category }),
    });
    if (res.ok) {
      const data = (await res.json()) as { item: MemoryItem };
      setMemories((prev) => [data.item, ...prev]);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    const res = await fetch(`/api/memory/${USER_ID}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleClearMemories = async () => {
    const res = await fetch(`/api/memory/${USER_ID}`, { method: 'DELETE' });
    if (res.ok) {
      setMemories([]);
    }
  };

  const handleAddTask = async (
    title: string,
    runAt: string | null,
    category: TaskCategory = 'general'
  ) => {
    const res = await fetch(`/api/tasks/${USER_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, run_at: runAt, category }),
    });
    if (res.ok) {
      const item = (await res.json()) as TaskItem;
      setTasks((prev) => [item, ...prev]);
    }
  };

  const handleToggleTask = async (task: TaskItem) => {
    const nextStatus = task.status === 'DONE' ? 'PENDING' : 'DONE';
    const res = await fetch(`/api/tasks/${USER_ID}/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      const data = (await res.json()) as { item: TaskItem };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.item : t)));
      if (dueBannerTask?.id === task.id && nextStatus === 'DONE') {
        setDueBannerTask(null);
      }
    }
  };

  const handleUpdateTaskCategory = async (task: TaskItem, category: TaskCategory) => {
    const res = await fetch(`/api/tasks/${USER_ID}/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    if (res.ok) {
      const data = (await res.json()) as { item: TaskItem };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.item : t)));
    }
  };

  const handleDeleteTask = async (id: number) => {
    const res = await fetch(`/api/tasks/${USER_ID}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleExecuteAction = async (
    action: string,
    payload: string,
    approved: boolean
  ): Promise<{ ok: boolean; message: string }> => {
    const res = await fetch('/api/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: USER_ID,
        action,
        payload,
        approved,
      }),
    });
    const data = (await res.json()) as {
      executed?: boolean;
      outcome?: string;
      error?: string;
      audit?: AuditItem;
      task?: TaskItem;
      memory?: MemoryItem;
    };

    if (data.audit) {
      setAudits((prev) => [data.audit!, ...prev]);
    }
    if (data.task) {
      setTasks((prev) => [data.task!, ...prev]);
    }
    if (data.memory) {
      setMemories((prev) => [data.memory!, ...prev]);
    }
    if (res.ok && action.toLowerCase() === 'clear_memories') {
      setMemories([]);
    }

    if (res.ok) {
      return { ok: true, message: data.outcome || 'Action executed.' };
    }
    return {
      ok: false,
      message: data.error || `Blocked (HTTP ${res.status})`,
    };
  };

  const handleSaveSuggestedTask = async (messageId: string, suggested: SuggestedTask) => {
    await handleAddTask(suggested.title, suggested.runAt, suggested.category ?? 'general');
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, taskSaved: true } : m))
    );
  };

  const handleDecideProposedAction = async (
    messageId: string,
    proposal: ProposedAction,
    approved: boolean
  ) => {
    const result = await handleExecuteAction(proposal.action, proposal.payload, approved);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              actionDecision: approved ? 'approved' : 'rejected',
              actionOutcome: result.message,
            }
          : m
      )
    );
  };

  const pendingTaskCount = tasks.filter((t) => t.status === 'PENDING').length;
  const completedTaskCount = tasks.filter((t) => t.status === 'DONE').length;
  const approvedAuditCount = audits.filter((a) => a.approved === 1).length;

  return (
    <div className="flex min-h-screen lg:h-screen w-full flex-col bg-slate-50 dark:bg-[#050914] dark:hud-backdrop text-slate-900 dark:text-slate-100 lg:overflow-hidden">
      <header className="flex items-center justify-between gap-8 border-b border-slate-200 dark:border-cyan-500/20 bg-white/95 dark:bg-[#080E1E]/90 backdrop-blur-md px-4 sm:px-6 py-3 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSection('workstation')}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-cyan-100 whitespace-nowrap shrink-0"
        >
          My Girl V2
        </button>

        <nav
          aria-label="Workspace Views"
          className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-medium"
        >
          {NAV_TABS.map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-slate-900 text-slate-900 dark:border-cyan-400 dark:text-cyan-200'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-cyan-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg border border-slate-200 dark:border-cyan-500/25 p-2 text-slate-600 hover:bg-slate-100 dark:text-cyan-200 dark:hover:bg-cyan-500/15 transition-colors shrink-0"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            disabled={!voice.speechSupported}
            onClick={() =>
              voice.wakeActive ? voice.stopWakeListener() : voice.startWakeListener()
            }
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
              voice.wakeActive
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-900 text-white dark:bg-gradient-to-r dark:from-cyan-500 dark:to-indigo-500 dark:text-slate-950 hover:opacity-90'
            }`}
          >
            {voice.wakeActive ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <MicOff className="h-3.5 w-3.5" />
            )}
            <span>{voice.wakeActive ? 'Wake Active' : 'Enable Wake'}</span>
          </button>
        </div>
      </header>

      {dueBannerTask && (
        <div className="border-b border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/35 px-4 sm:px-6 py-2 flex items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <Bell className="h-4 w-4 shrink-0" />
            <span>
              Scheduled task due: <strong className="font-medium">{dueBannerTask.title}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleTask(dueBannerTask)}
              className="rounded-md bg-amber-900 text-white dark:bg-amber-300 dark:text-slate-950 px-2.5 py-1 font-medium"
            >
              Mark Done
            </button>
            <button
              type="button"
              onClick={() => setDueBannerTask(null)}
              className="text-amber-800 dark:text-amber-300 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 p-3 sm:p-4 lg:overflow-hidden">
        {activeSection === 'workstation' && (
          <div className="grid h-full grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Left HUD Column */}
            <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3.5 min-h-0">
              <HudWindow title="System Overview" subtitle="Live Agent Metrics">
                <SystemOverviewPanel
                  memoryCount={memories.length}
                  pendingTaskCount={pendingTaskCount}
                  completedTaskCount={completedTaskCount}
                  approvedAuditCount={approvedAuditCount}
                  totalAuditCount={audits.length}
                />
              </HudWindow>

              <HudWindow
                title="Task Scheduler"
                subtitle={`${pendingTaskCount} pending`}
                onToggleExpand={() => setActiveSection('tasks')}
                className="flex-1 min-h-[260px]"
              >
                <TasksView
                  items={tasks}
                  loading={loading}
                  onAdd={handleAddTask}
                  onToggleStatus={handleToggleTask}
                  onChangeCategory={handleUpdateTaskCategory}
                  onDelete={handleDeleteTask}
                  showAddForm={showTaskForm}
                  onToggleAddForm={setShowTaskForm}
                  compact
                />
              </HudWindow>
            </div>

            {/* Center Holographic Core + AI Chat Interface */}
            <div className="lg:col-span-4 xl:col-span-5 flex flex-col gap-3.5 min-h-0">
              <HoloCore
                sending={sending}
                dictating={voice.dictating}
                wakeActive={voice.wakeActive}
                speaking={voice.speaking}
                synthesizing={voice.synthesizing}
                language={language}
                onChangeLanguage={setLanguage}
                voiceEngine={voiceEngine}
                onChangeVoiceEngine={setVoiceEngine}
                elevenLabsConfigured={elevenLabsConfigured}
                elevenLabsVoices={elevenLabsVoices}
                selectedVoiceId={selectedVoiceId}
                onChangeVoiceId={setSelectedVoiceId}
                autoSpeak={autoSpeak}
                onToggleAutoSpeak={() => {
                  if (autoSpeak) voice.stopSpeaking();
                  setAutoSpeak((v) => !v);
                }}
                onStopSpeaking={voice.stopSpeaking}
                onToggleWake={() =>
                  voice.wakeActive ? voice.stopWakeListener() : voice.startWakeListener()
                }
                speechSupported={voice.speechSupported}
              />

              <HudWindow
                title="AI Chat Interface"
                subtitle="Burmese · English"
                onToggleExpand={() => setActiveSection('chat')}
                headerRight={
                  <button
                    type="button"
                    onClick={handleNewChat}
                    title="Reset Chat"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/70 dark:text-cyan-300/80 dark:hover:bg-cyan-500/15 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                }
                className="flex-1 min-h-[340px]"
              >
                <ChatView
                  messages={messages}
                  loadingHistory={loading}
                  sending={sending}
                  error={chatError}
                  draft={draft}
                  onChangeDraft={setDraft}
                  onSend={handleSend}
                  onSpeak={(text) => voice.speak(text)}
                  dictating={voice.dictating}
                  onToggleDictation={() =>
                    voice.dictating ? voice.stopDictation() : voice.startDictation()
                  }
                  speechSupported={voice.speechSupported}
                  wakeActive={voice.wakeActive}
                  wakeNotice={voice.voiceNotice}
                  onDismissWakeNotice={voice.clearVoiceNotice}
                  language={language}
                  onSaveSuggestedTask={handleSaveSuggestedTask}
                  onDecideProposedAction={handleDecideProposedAction}
                  compact
                />
              </HudWindow>
            </div>

            {/* Right HUD Column */}
            <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3.5 min-h-0">
              <HudWindow
                title="Memory Vault"
                subtitle={`${memories.length} items`}
                onToggleExpand={() => setActiveSection('memory')}
                className="flex-1 min-h-[240px]"
              >
                <MemoryView
                  items={memories}
                  loading={loading}
                  onAdd={handleAddMemory}
                  onDelete={handleDeleteMemory}
                  onClearAll={handleClearMemories}
                  showAddForm={showMemoryForm}
                  onToggleAddForm={setShowMemoryForm}
                  compact
                />
              </HudWindow>

              <HudWindow
                title="Approval Gate & Audit Logs"
                subtitle={`${audits.length} events`}
                onToggleExpand={() => setActiveSection('approval')}
                className="flex-1 min-h-[240px]"
              >
                <ApprovalView
                  audits={audits}
                  loading={loading}
                  onExecuteAction={handleExecuteAction}
                  compact
                />
              </HudWindow>

              <HudWindow title="Shortcuts" subtitle="Quick Actions">
                <ShortcutsPanel
                  dictating={voice.dictating}
                  speechSupported={voice.speechSupported}
                  onVoiceDictate={() =>
                    voice.dictating ? voice.stopDictation() : voice.startDictation()
                  }
                  onOpenNewTask={() => setShowTaskForm(true)}
                  onOpenNewMemory={() => setShowMemoryForm(true)}
                  onClearChat={handleNewChat}
                />
              </HudWindow>
            </div>
          </div>
        )}

        {activeSection === 'chat' && (
          <HudWindow
            title="AI Chat Interface"
            subtitle="Expanded View"
            expanded
            onToggleExpand={() => setActiveSection('workstation')}
            headerRight={
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200/70 dark:text-cyan-200 dark:hover:bg-cyan-500/15"
              >
                <RotateCcw className="h-3 w-3" />
                <span>New Chat</span>
              </button>
            }
            className="h-full"
          >
            <ChatView
              messages={messages}
              loadingHistory={loading}
              sending={sending}
              error={chatError}
              draft={draft}
              onChangeDraft={setDraft}
              onSend={handleSend}
              onSpeak={(text) => voice.speak(text)}
              dictating={voice.dictating}
              onToggleDictation={() =>
                voice.dictating ? voice.stopDictation() : voice.startDictation()
              }
              speechSupported={voice.speechSupported}
              wakeActive={voice.wakeActive}
              wakeNotice={voice.voiceNotice}
              onDismissWakeNotice={voice.clearVoiceNotice}
              language={language}
              onSaveSuggestedTask={handleSaveSuggestedTask}
              onDecideProposedAction={handleDecideProposedAction}
            />
          </HudWindow>
        )}

        {activeSection === 'memory' && (
          <HudWindow
            title="Memory Vault"
            subtitle={`${memories.length} items`}
            expanded
            onToggleExpand={() => setActiveSection('workstation')}
            headerRight={
              <button
                type="button"
                onClick={() => setShowMemoryForm((v) => !v)}
                className="rounded-md bg-slate-900 dark:bg-cyan-500 px-2.5 py-1 text-[11px] font-semibold text-white dark:text-slate-950"
              >
                Add Memory
              </button>
            }
            className="h-full"
          >
            <MemoryView
              items={memories}
              loading={loading}
              onAdd={handleAddMemory}
              onDelete={handleDeleteMemory}
              onClearAll={handleClearMemories}
              showAddForm={showMemoryForm}
              onToggleAddForm={setShowMemoryForm}
            />
          </HudWindow>
        )}

        {activeSection === 'tasks' && (
          <HudWindow
            title="Task Scheduler"
            subtitle={`${pendingTaskCount} pending`}
            expanded
            onToggleExpand={() => setActiveSection('workstation')}
            className="h-full"
          >
            <TasksView
              items={tasks}
              loading={loading}
              onAdd={handleAddTask}
              onToggleStatus={handleToggleTask}
              onChangeCategory={handleUpdateTaskCategory}
              onDelete={handleDeleteTask}
              showAddForm={showTaskForm}
              onToggleAddForm={setShowTaskForm}
            />
          </HudWindow>
        )}

        {activeSection === 'approval' && (
          <HudWindow
            title="Approval Gate & Audit Logs"
            subtitle={`${audits.length} events`}
            expanded
            onToggleExpand={() => setActiveSection('workstation')}
            className="h-full"
          >
            <ApprovalView
              audits={audits}
              loading={loading}
              onExecuteAction={handleExecuteAction}
            />
          </HudWindow>
        )}
      </main>
    </div>
  );
}
