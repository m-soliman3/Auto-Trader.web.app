import cors from 'cors';
import express from 'express';
import { config } from './config';
import { requireUserAuth } from './auth';
import { generateAssistantReply } from './assistant';
import { ChatRequestBody, ChatTurn } from './types';

const app = express();

app.use(cors({ origin: config.allowedOrigin === '*' ? true : config.allowedOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'auto-trader-chatbot-backend',
    at: new Date().toISOString(),
  });
});

app.post('/v1/public-chat', async (req, res) => {
  try {
    const body = req.body as ChatRequestBody;
    const message = String(body?.message || '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const sanitizedHistory: ChatTurn[] = history
      .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant'))
      .map((turn) => ({
        role: turn.role,
        content: String(turn.content || '').slice(0, 2000),
      }))
      .filter((turn) => turn.content.length > 0);

    const response = await generateAssistantReply(message, sanitizedHistory, false);
    res.status(200).json(response);
  } catch (error: any) {
    console.error('public-chat endpoint failed', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

app.post('/v1/chat', requireUserAuth, async (req, res) => {
  try {
    const body = req.body as ChatRequestBody;
    const message = String(body?.message || '').trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const sanitizedHistory: ChatTurn[] = history
      .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant'))
      .map((turn) => ({
        role: turn.role,
        content: String(turn.content || '').slice(0, 2000),
      }))
      .filter((turn) => turn.content.length > 0);

    const response = await generateAssistantReply(message, sanitizedHistory, true);
    res.status(200).json(response);
  } catch (error: any) {
    console.error('chat endpoint failed', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

app.listen(config.port, () => {
  console.log(`auto-trader-chatbot-backend listening on port ${config.port}`);
});
