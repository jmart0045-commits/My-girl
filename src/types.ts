export type ActiveSection = 'workstation' | 'chat' | 'memory' | 'tasks' | 'approval';

export type VoiceLanguage = 'my-MM' | 'en-US';

export type VoiceEngine = 'elevenlabs' | 'browser';

export interface ElevenLabsVoice {
  id: string;
  name: string;
  category?: string;
}

export interface MemoryItem {
  id: number;
  user_id: string;
  content: string;
  category: string;
  created_at: string;
}

export type TaskCategory = 'general' | 'personal' | 'work' | 'urgent';

export interface TaskItem {
  id: number;
  user_id: string;
  title: string;
  status: 'PENDING' | 'DONE';
  category: TaskCategory;
  run_at: string | null;
  created_at: string;
}

export interface AuditItem {
  id: number;
  user_id: string;
  action: string;
  payload: string | null;
  approved: number;
  outcome: string;
  created_at: string;
}

export interface SuggestedTask {
  title: string;
  runAt: string | null;
  category?: TaskCategory;
}

export interface ProposedAction {
  action: string;
  summary: string;
  payload: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  savedMemory?: MemoryItem | null;
  suggestedTask?: SuggestedTask | null;
  taskSaved?: boolean;
  proposedAction?: ProposedAction | null;
  actionDecision?: 'approved' | 'rejected' | null;
  actionOutcome?: string | null;
}
