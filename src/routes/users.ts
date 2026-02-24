import { Router } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, type AuthReq } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.patch('/me', requireAuth, async (req: AuthReq, res) => {
  const userId = req.userId!;
  const body = req.body as { email?: string; displayName?: string; onboardingCompleted?: boolean };
  const [updated] = await db
    .update(users)
    .set({
      ...(body.email !== undefined && { email: body.email }),
      ...(body.displayName !== undefined && { displayName: body.displayName }),
      ...(body.onboardingCompleted !== undefined && { onboardingCompleted: body.onboardingCompleted ? 1 : 0 }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json({
    user: {
      id: updated.id,
      email: updated.email ?? undefined,
      displayName: updated.displayName ?? undefined,
      onboardingCompleted: Boolean(updated.onboardingCompleted),
    },
  });
});
