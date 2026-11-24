import { Brain, CheckSquare, Mic, RotateCcw } from 'lucide-react';

interface ShortcutsPanelProps {
  dictating: boolean;
  speechSupported: boolean;
  onVoiceDictate: () => void;
  onOpenNewTask: () => void;
  onOpenNewMemory: () => void;
  onClearChat: () => void;
}

export function ShortcutsPanel({
  dictating,
  speechSupported,
  onVoiceDictate,
  onOpenNewTask,
  onOpenNewMemory,
  onClearChat,
}: ShortcutsPanelProps) {
  const items = [
    {
      label: dictating ? 'Stop Mic' : 'Voice Input',
      icon: Mic,
      onClick: onVoiceDictate,
      disabled: !speechSupported,
      active: dictating,
    },
    {
      label: 'Add Memory',
      icon: Brain,
      onClick: onOpenNewMemory,
      disabled: false,
      active: false,
    },
    {
      label: 'New Task',
      icon: CheckSquare,
      onClick: onOpenNewTask,
      disabled: false,
      active: false,
    },
    {
      label: 'Reset Chat',
      icon: RotateCcw,
      onClick: onClearChat,
      disabled: false,
      active: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={item.onClick}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              item.active
                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50/50 dark:border-cyan-500/20 dark:bg-[#0D162B] dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-500/10'
            }`}
          >
            <Icon className="h-4 w-4 text-sky-600 dark:text-cyan-300" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
