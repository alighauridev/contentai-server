import { Router } from 'express';
import { requireAuth, type AuthReq } from '../middleware/auth.js';
import type { ImageGenerateBody } from '../lib/types.js';
import { generateNImages } from '../services/images.js';
import { checkImageLimit, incrementImageUsage } from '../lib/usage.js';

export const imagesRouter = Router();

imagesRouter.post('/generate', requireAuth, async (req: AuthReq, res) => {
  const body = req.body as ImageGenerateBody;
  if (!body.prompt || !body.imageModelId || !body.aspectRatio || !body.style) {
    res.status(400).json({ message: 'Missing prompt, imageModelId, aspectRatio, or style' });
    return;
  }
  const userId = req.userId!;
  const limitCheck = await checkImageLimit(userId);
  if (!limitCheck.allowed) {
    res.status(429).json({ message: limitCheck.message });
    return;
  }
  const numImages = (body.numImages ?? 3) as 1 | 2 | 3;
  try {
    const imageUrls = await generateNImages(numImages, body.imageModelId, body.prompt, body.aspectRatio, body.style);
    await incrementImageUsage(userId);
    res.json({ imageUrls });
  } catch (e) {
    console.error('Image generation error:', e);
    res.status(500).json({ message: e instanceof Error ? e.message : 'Image generation failed' });
  }
});
