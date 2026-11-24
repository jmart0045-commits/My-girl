import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  addAuditLog,
  addMemory,
  addMessage,
  addTask,
  clearMemories,
  clearMessages,
  deleteMemoryById,
  deleteTaskById,
  getDb,
  listAuditLogs,
  listMemories,
  listMessages,
  listTasks,
  updateTask,
} from './server/db.ts';
import { generateAgentReply, type HistoryTurn } from './server/agent.ts';
import {
  ElevenLabsError,
  listElevenLabsVoices,
  synthesizeElevenLabsSpeech,
} from './server/elevenlabs.ts';

const PORT = Number(process.env.PORT) || 3000;
const VALID_UID = /^[a-zA-Z0-9_-]{1,80}$/;

function parseUid(raw: unknown): string {
  const val = typeof raw === 'string' ? raw.trim() : 'default';
  if (!val) return 'default';
  if (!VALID_UID.test(val)) {
    throw new Error('Invalid user_id format.');
  }
  return val;
}

async function startServer() {
  getDb();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, agent: 'My Girl V2' });
  });

  app.get('/api/chat/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const items = listMessages(uid);
      res.json({ items });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.delete('/api/chat/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const deleted = clearMessages(uid);
      res.json({ deleted });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const body = req.body as {
        user_id?: unknown;
        message?: unknown;
        history?: unknown;
      };
      const uid = parseUid(body?.user_id ?? 'default');
      const message = typeof body?.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 12000) {
        res.status(400).json({ error: 'Message must be between 1 and 12000 characters.' });
        return;
      }

      const rawHistory = Array.isArray(body?.history) ? body.history : [];
      const history: HistoryTurn[] = rawHistory
        .filter(
          (item): item is { role: string; content: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as { role?: unknown }).role === 'string' &&
            typeof (item as { content?: unknown }).content === 'string'
        )
        .slice(-12);

      const memRows = listMemories(uid, 12);
      const memories = [...memRows].reverse().map((r) => r.content);
      const pendingTasks = listTasks(uid)
        .filter((t) => t.status === 'PENDING')
        .map((t) => (t.run_at ? `${t.title} (due ${t.run_at})` : t.title));

      const agentResult = await generateAgentReply(message, memories, history, pendingTasks);

      const userMsg = addMessage(uid, 'user', message);
      const assistantMsg = addMessage(uid, 'assistant', agentResult.reply);

      let savedMemory = null;
      const lower = message.toLowerCase();
      const explicitRememberKeyword =
        lower.includes('remember this') ||
        message.includes('မှတ်ထား') ||
        message.includes('မှတ်ထားပေး');

      if (agentResult.suggestedMemory?.content) {
        savedMemory = addMemory(
          uid,
          agentResult.suggestedMemory.content,
          agentResult.suggestedMemory.category || 'note'
        );
      } else if (explicitRememberKeyword) {
        savedMemory = addMemory(uid, message.slice(0, 1000), 'note');
      }

      res.json({
        reply: agentResult.reply,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        savedMemory,
        suggestedTask: agentResult.suggestedTask,
        proposedAction: agentResult.proposedAction,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI provider error';
      const status = msg.includes('GEMINI_API_KEY') ? 503 : 502;
      res.status(status).json({ error: msg });
    }
  });

  app.get('/api/memory/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      res.json({ items: listMemories(uid) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.post('/api/memory/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const body = req.body as { content?: unknown; category?: unknown };
      const content = typeof body?.content === 'string' ? body.content.trim() : '';
      const category = typeof body?.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 40) : 'note';
      if (!content || content.length > 1000) {
        res.status(400).json({ error: 'Memory content must be 1 to 1000 characters.' });
        return;
      }
      const item = addMemory(uid, content, category);
      res.status(201).json({ item });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.delete('/api/memory/:uid/:id', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid memory ID.' });
        return;
      }
      const deleted = deleteMemoryById(uid, id);
      res.json({ deleted });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.delete('/api/memory/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const count = clearMemories(uid);
      res.json({ deleted: true, count });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.get('/api/tasks/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      res.json({ items: listTasks(uid) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  const validTaskCategories = new Set(['general', 'personal', 'work', 'urgent']);

  app.post('/api/tasks/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const body = req.body as { title?: unknown; run_at?: unknown; category?: unknown };
      const title = typeof body?.title === 'string' ? body.title.trim() : '';
      const runAt = typeof body?.run_at === 'string' && body.run_at.trim() ? body.run_at.trim().slice(0, 80) : null;
      const rawCat = typeof body?.category === 'string' ? body.category.trim().toLowerCase() : 'general';
      const category = rawCat || 'general';
      if (!validTaskCategories.has(category)) {
        res.status(400).json({ error: 'Category must be general, personal, work, or urgent.' });
        return;
      }
      if (!title || title.length > 300) {
        res.status(400).json({ error: 'Task title must be 1 to 300 characters.' });
        return;
      }
      const item = addTask(uid, title, runAt, category);
      res.status(201).json(item);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.patch('/api/tasks/:uid/:id', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid task ID.' });
        return;
      }
      const body = req.body as { status?: unknown; title?: unknown; category?: unknown; run_at?: unknown };
      const updates: { status?: string; title?: string; category?: string; run_at?: string | null } = {};
      if (typeof body?.status === 'string') {
        if (body.status !== 'PENDING' && body.status !== 'DONE') {
          res.status(400).json({ error: 'Status must be PENDING or DONE.' });
          return;
        }
        updates.status = body.status;
      }
      if (typeof body?.title === 'string') {
        const trimmed = body.title.trim();
        if (!trimmed || trimmed.length > 300) {
          res.status(400).json({ error: 'Title must be 1 to 300 characters.' });
          return;
        }
        updates.title = trimmed;
      }
      if (typeof body?.category === 'string') {
        const cat = body.category.trim().toLowerCase();
        if (!validTaskCategories.has(cat)) {
          res.status(400).json({ error: 'Category must be general, personal, work, or urgent.' });
          return;
        }
        updates.category = cat;
      }
      if (body?.run_at !== undefined) {
        updates.run_at = typeof body.run_at === 'string' && body.run_at.trim() ? body.run_at.trim().slice(0, 80) : null;
      }
      const item = updateTask(uid, id, updates);
      if (!item) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }
      res.json({ item });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.delete('/api/tasks/:uid/:id', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid task ID.' });
        return;
      }
      const deleted = deleteTaskById(uid, id);
      res.json({ deleted });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.get('/api/actions/:uid', (req, res) => {
    try {
      const uid = parseUid(req.params.uid);
      res.json({ items: listAuditLogs(uid) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.post('/api/actions/execute', (req, res) => {
    try {
      const body = req.body as {
        user_id?: unknown;
        action?: unknown;
        payload?: unknown;
        approved?: unknown;
      };
      const uid = parseUid(body?.user_id ?? 'default');
      const action = typeof body?.action === 'string' ? body.action.trim() : '';
      const payload = typeof body?.payload === 'string' ? body.payload.trim().slice(0, 4000) : null;
      const approved = body?.approved === true;

      if (!action || action.length > 200) {
        res.status(400).json({ error: 'Action must be 1 to 200 characters.' });
        return;
      }

      if (!approved) {
        const record = addAuditLog(uid, action, payload, false, 'Rejected: user approval required.');
        res.status(403).json({ error: 'User approval required.', audit: record });
        return;
      }

      const normalized = action.toLowerCase();
      if (normalized === 'clear_memories') {
        const count = clearMemories(uid);
        const record = addAuditLog(
          uid,
          action,
          payload,
          true,
          `Executed: cleared ${count} stored memories.`
        );
        res.json({ executed: true, outcome: record.outcome, audit: record });
        return;
      }

      if (normalized === 'create_task' && payload) {
        const task = addTask(uid, payload.slice(0, 300), null);
        const record = addAuditLog(uid, action, payload, true, `Executed: created task #${task.id}.`);
        res.json({ executed: true, outcome: record.outcome, task, audit: record });
        return;
      }

      if (normalized === 'save_memory' && payload) {
        const mem = addMemory(uid, payload.slice(0, 1000), 'note');
        const record = addAuditLog(uid, action, payload, true, `Executed: saved memory #${mem.id}.`);
        res.json({ executed: true, outcome: record.outcome, memory: mem, audit: record });
        return;
      }

      if (normalized === 'draft_message') {
        const record = addAuditLog(
          uid,
          action,
          payload,
          true,
          'Approved draft ready for manual copy/send. External dispatch requires a connected messaging adapter.'
        );
        res.json({ executed: true, outcome: record.outcome, draft: payload, audit: record });
        return;
      }

      const record = addAuditLog(
        uid,
        action,
        payload,
        true,
        'No external device/service adapter configured. Logged as approved without side effects.'
      );
      res.status(501).json({
        error: 'No external action adapter configured. No external action was executed.',
        audit: record,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bad request' });
    }
  });

  app.get('/api/tts/voices', async (_req, res) => {
    const result = await listElevenLabsVoices();
    res.json(result);
  });

  app.post('/api/tts', async (req, res) => {
    try {
      const body = req.body as {
        text?: unknown;
        voiceId?: unknown;
        modelId?: unknown;
      };
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 2500) {
        res.status(400).json({ error: 'Text must be between 1 and 2500 characters.' });
        return;
      }
      const voiceId = typeof body?.voiceId === 'string' ? body.voiceId : undefined;
      const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;

      const audioBuffer = await synthesizeElevenLabsSpeech({ text, voiceId, modelId });
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.send(audioBuffer);
    } catch (err) {
      if (err instanceof ElevenLabsError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'ElevenLabs synthesis failed.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`My Girl V2 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
