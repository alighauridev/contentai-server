import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authRouter } from './routes/auth.js';
import { brandVoiceRouter } from './routes/brand-voice.js';
import { captionsRouter } from './routes/captions.js';
import { imagesRouter } from './routes/images.js';
import { postsRouter } from './routes/posts.js';
import { usageRouter } from './routes/usage.js';
import { usersRouter } from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/brand-voice', brandVoiceRouter);
app.use('/captions', captionsRouter);
app.use('/images', imagesRouter);
app.use('/posts', postsRouter);
app.use('/usage', usageRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
