import { GoogleGenAI, Type } from '@google/genai';

export interface HistoryTurn {
  role: string;
  content: string;
}

export interface AgentTaskSuggestion {
  title: string;
  runAt: string | null;
  category?: 'personal' | 'work' | 'urgent' | 'general';
}

export interface AgentActionProposal {
  action: string;
  summary: string;
  payload: string;
}

export interface AgentResponse {
  reply: string;
  suggestedMemory: { content: string; category: string } | null;
  suggestedTask: AgentTaskSuggestion | null;
  proposedAction: AgentActionProposal | null;
}

const SYSTEM_PROMPT = `You are My Girl, a friendly, attentive personal AI assistant.
- Language matching: Reply naturally in Burmese (Myanmar Unicode) whenever the user writes in Burmese; otherwise match their language (e.g., English) cleanly.
- Capabilities & honesty: You can reason, plan, organize tasks, remember user facts, explain concepts, and draft messages. Never claim an external action (sending emails, calling, opening phone apps, deleting records, buying items) has already happened unless a connected tool confirms it.
- Explicit confirmation policy: Whenever the user asks to perform an external or sensitive side-effect action (e.g., send email/SMS, open an external app, delete memories, publish content, make a purchase), propose it in "proposedAction" and ask for their explicit confirmation in your reply.
- Memory extraction: If the user explicitly asks you to remember a fact or states a clear personal preference/detail worth remembering ("remember this", "မှတ်ထား", "မှတ်ထားပေး"), populate "suggestedMemory" with a concise summary and category ("personal", "preference", or "note"). Otherwise leave "suggestedMemory" null.
- Task extraction: If the user asks to be reminded or to schedule a task/todo, populate "suggestedTask" with a concise title and optional ISO-like runAt datetime string (if a date/time was mentioned, relative to the current time provided). Otherwise leave "suggestedTask" null.
- Security: Never request or reveal API keys, passwords, or private secrets.
- Keep responses concise, warm, and well-structured without markdown clutter.`;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function generateAgentReply(
  message: string,
  memories: string[],
  history: HistoryTurn[],
  tasksSummary: string[]
): Promise<AgentResponse> {
  const ai = getClient();

  const memoryContext =
    memories.length > 0 ? memories.slice(-12).map((m) => `- ${m}`).join('\n') : '(none saved yet)';
  const taskContext =
    tasksSummary.length > 0
      ? tasksSummary.slice(0, 8).map((t) => `- ${t}`).join('\n')
      : '(no pending tasks)';

  const contents = [
    ...history
      .slice(-12)
      .filter((h) => (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
      .map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content.slice(0, 8000) }],
      })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  const systemInstruction = `${SYSTEM_PROMPT}

Current local timestamp: ${new Date().toISOString()}

User memories:
${memoryContext}

Active user tasks:
${taskContext}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Assistant reply in Burmese if user wrote Burmese, otherwise matching user language.',
          },
          suggestedMemory: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              content: { type: Type.STRING },
              category: { type: Type.STRING },
            },
          },
          suggestedTask: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              title: { type: Type.STRING },
              runAt: { type: Type.STRING, nullable: true },
              category: {
                type: Type.STRING,
                nullable: true,
                description: 'One of: personal, work, urgent, general',
              },
            },
          },
          proposedAction: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              action: {
                type: Type.STRING,
                description:
                  'Action identifier such as draft_message, clear_memories, device_navigation, or external_send',
              },
              summary: {
                type: Type.STRING,
                description: 'Human-readable summary of what will happen if approved',
              },
              payload: {
                type: Type.STRING,
                description: 'Draft text or parameters for the action',
              },
            },
          },
        },
        required: ['reply'],
      },
    },
  });

  const rawText = response.text?.trim() ?? '';
  if (!rawText) {
    throw new Error('Model returned an empty response.');
  }

  try {
    const parsed = JSON.parse(rawText) as Partial<AgentResponse>;
    return {
      reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply : rawText,
      suggestedMemory:
        parsed.suggestedMemory && typeof parsed.suggestedMemory.content === 'string'
          ? {
              content: parsed.suggestedMemory.content.trim().slice(0, 1000),
              category:
                typeof parsed.suggestedMemory.category === 'string' && parsed.suggestedMemory.category.trim()
                  ? parsed.suggestedMemory.category.trim().slice(0, 40)
                  : 'note',
            }
          : null,
      suggestedTask:
        parsed.suggestedTask && typeof parsed.suggestedTask.title === 'string'
          ? {
              title: parsed.suggestedTask.title.trim().slice(0, 300),
              runAt:
                typeof parsed.suggestedTask.runAt === 'string' && parsed.suggestedTask.runAt.trim()
                  ? parsed.suggestedTask.runAt.trim().slice(0, 80)
                  : null,
              category:
                typeof parsed.suggestedTask.category === 'string' &&
                ['personal', 'work', 'urgent', 'general'].includes(
                  parsed.suggestedTask.category.trim().toLowerCase()
                )
                  ? (parsed.suggestedTask.category.trim().toLowerCase() as
                      | 'personal'
                      | 'work'
                      | 'urgent'
                      | 'general')
                  : 'general',
            }
          : null,
      proposedAction:
        parsed.proposedAction && typeof parsed.proposedAction.action === 'string'
          ? {
              action: parsed.proposedAction.action.trim().slice(0, 120),
              summary:
                typeof parsed.proposedAction.summary === 'string'
                  ? parsed.proposedAction.summary.trim().slice(0, 400)
                  : parsed.proposedAction.action,
              payload:
                typeof parsed.proposedAction.payload === 'string'
                  ? parsed.proposedAction.payload.trim().slice(0, 4000)
                  : '',
            }
          : null,
    };
  } catch {
    return {
      reply: rawText,
      suggestedMemory: null,
      suggestedTask: null,
      proposedAction: null,
    };
  }
}
