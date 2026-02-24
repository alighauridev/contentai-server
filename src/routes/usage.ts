import { Router } from 'express';
import { db } from '../db/index.js';
import { usage } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, type AuthReq } from '../middleware/auth.js';
import { getCreditsRemaining, CREDITS_PER_MONTH } from '../lib/usage.js';

export const usageRouter = Router();

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

usageRouter.get('/', requireAuth, async (req: AuthReq, res) => {
  const userId = req.userId!;
  const month = currentMonth();

  const [creditsRemaining, usageRow] = await Promise.all([
    getCreditsRemaining(userId),
    db
      .select()
      .from(usage)
      .where(and(eq(usage.userId, userId), eq(usage.month, month)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const creditsUsed = CREDITS_PER_MONTH - creditsRemaining;

  res.json({
    creditsRemaining,
    creditsUsed,
    creditsLimit: CREDITS_PER_MONTH,
    imageCount: usageRow?.imageCount ?? 0,
    captionCount: usageRow?.captionCount ?? 0,
  });
});
