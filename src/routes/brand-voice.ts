import { Router } from 'express';
import { db } from '../db/index.js';
import { brandVoice } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, type AuthReq } from '../middleware/auth.js';
import type { BrandVoiceBody } from '../lib/types.js';

export const brandVoiceRouter = Router();

function rowToBrandVoice(row: { accountType: string; brandName: string | null; niche: string | null; targetAudience: string | null; website: string | null; platforms: unknown; toneTags: unknown; toneSliders: unknown }) {
  const sliders = row.toneSliders as { casualProfessional: number; playfulSerious: number; shortDetailed: number };
  return {
    accountType: row.accountType as 'brand' | 'creator' | 'business',
    brandName: row.brandName ?? undefined,
    niche: row.niche ?? undefined,
    targetAudience: row.targetAudience ?? undefined,
    website: row.website ?? undefined,
    platforms: (row.platforms as string[]) ?? [],
    toneTags: (row.toneTags as string[]) ?? [],
    toneSliders: sliders ?? { casualProfessional: 0.5, playfulSerious: 0.5, shortDetailed: 0.5 },
  };
}

brandVoiceRouter.get('/', requireAuth, async (req: AuthReq, res) => {
  const userId = req.userId!;
  const [row] = await db.select().from(brandVoice).where(eq(brandVoice.userId, userId)).limit(1);
  if (!row) {
    res.json({ brandVoice: null });
    return;
  }
  res.json({ brandVoice: rowToBrandVoice(row) });
});

brandVoiceRouter.put('/', requireAuth, async (req: AuthReq, res) => {
  const userId = req.userId!;
  const body = req.body as BrandVoiceBody;
  const [row] = await db
    .insert(brandVoice)
    .values({
      userId,
      accountType: body.accountType,
      brandName: body.brandName ?? null,
      niche: body.niche ?? null,
      targetAudience: body.targetAudience ?? null,
      website: body.website ?? null,
      platforms: body.platforms ?? [],
      toneTags: body.toneTags ?? [],
      toneSliders: body.toneSliders,
    })
    .onConflictDoUpdate({
      target: brandVoice.userId,
      set: {
        accountType: body.accountType,
        brandName: body.brandName ?? null,
        niche: body.niche ?? null,
        targetAudience: body.targetAudience ?? null,
        website: body.website ?? null,
        platforms: body.platforms ?? [],
        toneTags: body.toneTags ?? [],
        toneSliders: body.toneSliders,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) {
    res.status(500).json({ message: 'Failed to save brand voice' });
    return;
  }
  res.json({ brandVoice: rowToBrandVoice(row) });
});
