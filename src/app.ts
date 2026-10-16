import express, { type NextFunction, type Request, type Response } from 'express';
// Express 4 ignores rejected promises from async handlers, so one failed DB call
// (e.g. a network blip) crashed the whole server. This forwards them to the error handler.
import 'express-async-errors';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { brandVoiceRouter } from './routes/brand-voice.js';
import { captionsRouter } from './routes/captions.js';
import { imagesRouter } from './routes/images.js';
import { postsRouter } from './routes/posts.js';
import { usageRouter } from './routes/usage.js';
import { usersRouter } from './routes/users.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/brand-voice', brandVoiceRouter);
app.use('/captions', captionsRouter);
app.use('/images', imagesRouter);
app.use('/posts', postsRouter);
app.use('/usage', usageRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return;
  const offline = err instanceof Error && /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/.test(`${err.message} ${String(err.cause ?? '')}`);
  res.status(offline ? 503 : 500).json({
    message: offline ? 'Server could not reach the database. Please try again.' : 'Something went wrong. Please try again.',
  });
});

export default app;
