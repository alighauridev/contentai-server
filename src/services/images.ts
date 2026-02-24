import type { ImageModelId, AspectRatio, ImageStyle } from '../lib/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

const FAL_FLUX_URL = 'https://fal.run/fal-ai/flux/dev';
const REPLICATE_SDXL = 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

function aspectToSize(ratio: AspectRatio): { width: number; height: number } {
  switch (ratio) {
    case '1:1': return { width: 1024, height: 1024 };
    case '4:5': return { width: 1024, height: 1280 };
    case '9:16': return { width: 576, height: 1024 };
    default: return { width: 1024, height: 1024 };
  }
}

function styleSuffix(style: ImageStyle): string {
  switch (style) {
    case 'photorealistic': return ', photorealistic, high quality photo';
    case 'artistic': return ', artistic, creative, stylized';
    case '3d': return ', 3D render, octane render';
    default: return '';
  }
}

// ── Download the image from a temporary URL and save it permanently ───────────
async function downloadAndPersist(tempUrl: string): Promise<string> {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const res = await fetch(tempUrl);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const baseUrl = process.env.SERVER_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  return `${baseUrl}/uploads/${filename}`;
}

// ── AI providers ──────────────────────────────────────────────────────────────
async function generateWithFal(prompt: string, ratio: AspectRatio, style: ImageStyle): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not set');
  const { width, height } = aspectToSize(ratio);
  const res = await fetch(FAL_FLUX_URL, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt + styleSuffix(style),
      image_size: { width, height },
      num_inference_steps: 28,
      num_images: 1,
    }),
  });
  if (!res.ok) throw new Error(`fal.ai error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { images?: Array<{ url?: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('No image URL from fal.ai');
  return downloadAndPersist(url);
}

async function generateWithReplicate(prompt: string, ratio: AspectRatio, style: ImageStyle): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  const { width, height } = aspectToSize(ratio);
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({
      version: REPLICATE_SDXL,
      input: { prompt: prompt + styleSuffix(style), width, height },
    }),
  });
  if (!res.ok) throw new Error(`Replicate error: ${res.status} ${await res.text()}`);
  const pred = (await res.json()) as { status?: string; output?: string | string[] };
  if (pred.status === 'succeeded' && pred.output) {
    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    return downloadAndPersist(String(out));
  }
  if (pred.status === 'failed') throw new Error('Replicate prediction failed');
  throw new Error('Replicate prediction timed out');
}

async function generateWithDalle3(prompt: string, ratio: AspectRatio, style: ImageStyle): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const size = ratio === '9:16' ? '1024x1792' : '1024x1024';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt: prompt + styleSuffix(style), n: 1, size }),
  });
  if (!res.ok) throw new Error(`DALL-E 3 error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { data?: Array<{ url?: string }> };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('No image URL from DALL-E 3');
  return downloadAndPersist(url);
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateImage(
  modelId: ImageModelId,
  prompt: string,
  aspectRatio: AspectRatio,
  style: ImageStyle
): Promise<string> {
  if (modelId === 'flux') return generateWithFal(prompt, aspectRatio, style);
  if (modelId === 'sdxl') return generateWithReplicate(prompt, aspectRatio, style);
  if (modelId === 'dalle3') return generateWithDalle3(prompt, aspectRatio, style);
  if (modelId === 'gemini-imagen') {
    return `https://placehold.co/1024x1024/7C3AED/fff?text=Gemini+Imagen+Coming+Soon`;
  }
  return generateWithFal(prompt, aspectRatio, style);
}

export async function generateThreeImages(
  modelId: ImageModelId,
  prompt: string,
  aspectRatio: AspectRatio,
  style: ImageStyle
): Promise<string[]> {
  return generateNImages(3, modelId, prompt, aspectRatio, style);
}

export async function generateNImages(
  count: 1 | 2 | 3,
  modelId: ImageModelId,
  prompt: string,
  aspectRatio: AspectRatio,
  style: ImageStyle
): Promise<string[]> {
  const tasks = Array.from({ length: count }, () =>
    generateImage(modelId, prompt, aspectRatio, style)
  );
  return Promise.all(tasks);
}
