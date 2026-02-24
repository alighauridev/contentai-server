import { db } from '../db/index.js';
import { users, usage } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export const CREDITS_PER_MONTH = 10;

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Reset credits to CREDITS_PER_MONTH if the user's last reset was in a prior month
async function ensureMonthReset(userId: string): Promise<void> {
  const month = currentMonth();
  const [user] = await db
    .select({ creditsResetMonth: users.creditsResetMonth })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;
  if (user.creditsResetMonth !== month) {
    await db
      .update(users)
      .set({ creditsBalance: CREDITS_PER_MONTH, creditsResetMonth: month, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export async function getCreditsRemaining(userId: string): Promise<number> {
  await ensureMonthReset(userId);
  const [user] = await db
    .select({ creditsBalance: users.creditsBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.creditsBalance ?? CREDITS_PER_MONTH;
}

export async function checkCreditLimit(
  userId: string,
): Promise<{ allowed: boolean; message?: string; creditsRemaining: number }> {
  const remaining = await getCreditsRemaining(userId);
  if (remaining <= 0) {
    return {
      allowed: false,
      message: `You have used all ${CREDITS_PER_MONTH} credits for this month.`,
      creditsRemaining: 0,
    };
  }
  return { allowed: true, creditsRemaining: remaining };
}

// Atomically deduct 1 credit (never goes below 0)
async function deductCredit(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      creditsBalance: sql`GREATEST(${users.creditsBalance} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// Keep existing named exports so existing routes compile unchanged
export async function checkCaptionLimit(
  userId: string,
): Promise<{ allowed: boolean; message?: string }> {
  return checkCreditLimit(userId);
}

export async function checkImageLimit(
  userId: string,
): Promise<{ allowed: boolean; message?: string }> {
  return checkCreditLimit(userId);
}

export async function incrementCaptionUsage(userId: string): Promise<void> {
  await deductCredit(userId);
  // Also track in usage table for analytics
  const month = currentMonth();
  const [row] = await db
    .select()
    .from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.month, month)))
    .limit(1);
  if (row) {
    await db
      .update(usage)
      .set({ captionCount: (row.captionCount ?? 0) + 1, updatedAt: new Date() })
      .where(and(eq(usage.userId, userId), eq(usage.month, month)));
  } else {
    await db.insert(usage).values({ userId, month, captionCount: 1, imageCount: 0 });
  }
}

export async function incrementImageUsage(userId: string): Promise<void> {
  await deductCredit(userId);
  // Also track in usage table for analytics
  const month = currentMonth();
  const [row] = await db
    .select()
    .from(usage)
    .where(and(eq(usage.userId, userId), eq(usage.month, month)))
    .limit(1);
  if (row) {
    await db
      .update(usage)
      .set({ imageCount: (row.imageCount ?? 0) + 1, updatedAt: new Date() })
      .where(and(eq(usage.userId, userId), eq(usage.month, month)));
  } else {
    await db.insert(usage).values({ userId, month, captionCount: 0, imageCount: 1 });
  }
}
