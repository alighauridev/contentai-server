import { Router } from 'express';
import { db } from '../db/index.js';
import { brandVoice } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, type AuthReq } from '../middleware/auth.js';
import type { CaptionGenerateBody } from '../lib/types.js';
import { buildCaptionPrompt, generateCaptions } from '../services/openrouter.js';
import { checkCaptionLimit, incrementCaptionUsage } from '../lib/usage.js';

export const captionsRouter = Router();

captionsRouter.post('/generate', requireAuth, async (req: AuthReq, res) => {
  const body = req.body as CaptionGenerateBody;
  if (!body.platform || !body.topic || !body.textModelId || !body.toneOverride) {
    res.status(400).json({ message: 'Missing platform, topic, textModelId, or toneOverride' });
    return;
  }
  const userId = req.userId!;
  const limitCheck = await checkCaptionLimit(userId);
  if (!limitCheck.allowed) {
    res.status(429).json({ message: limitCheck.message });
    return;
  }
  const [bv] = await db.select().from(brandVoice).where(eq(brandVoice.userId, userId)).limit(1);
  const brandVoiceSummary = bv
    ? {
        accountType: bv.accountType,
        niche: bv.niche ?? undefined,
        targetAudience: bv.targetAudience ?? undefined,
        toneTags: (bv.toneTags as string[]) ?? [],
        toneSliders: bv.toneSliders as { casualProfessional: number; playfulSerious: number; shortDetailed: number },
      }
    : null;
  const prompt = buildCaptionPrompt(
    body.platform,
    body.topic,
    body.toneOverride,
    brandVoiceSummary
  );
  try {
    const variations = await generateCaptions(body.textModelId, prompt);
    await incrementCaptionUsage(userId);
    res.json({ variations });
  } catch (e) {
    console.error('Caption generation error:', e);
    res.status(500).json({ message: e instanceof Error ? e.message : 'Caption generation failed' });
  }
});
