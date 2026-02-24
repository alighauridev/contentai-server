import express from 'express';
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

export default app;
