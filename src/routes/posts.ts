import { Router } from 'express';
import { db } from '../db/index.js';
import { posts } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, type AuthReq } from '../middleware/auth.js';
import type { CreatePostBody } from '../lib/types.js';

export const postsRouter = Router();

postsRouter.get('/', requireAuth, async (req: AuthReq, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
  res.json({
    posts: rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      selectedCaption: r.selectedCaption,
      imageUrl: r.imageUrl ?? undefined,
      templateId: r.templateId ?? undefined,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

postsRouter.post('/', requireAuth, async (req: AuthReq, res) => {
  const userId = req.userId!;
  const body = req.body as CreatePostBody;
  if (!body.platform || !body.selectedCaption) {
    res.status(400).json({ message: 'Missing platform or selectedCaption' });
    return;
  }
  const [row] = await db
    .insert(posts)
    .values({
      userId,
      platform: body.platform,
      selectedCaption: body.selectedCaption,
      imageUrl: body.imageUrl ?? null,
      templateId: body.templateId ?? null,
    })
    .returning();
  if (!row) {
    res.status(500).json({ message: 'Failed to save post' });
    return;
  }
  res.json({
    post: {
      id: row.id,
      platform: row.platform,
      selectedCaption: row.selectedCaption,
      imageUrl: row.imageUrl ?? undefined,
      templateId: row.templateId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    },
  });
});
