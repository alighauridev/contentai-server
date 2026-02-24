import type { TextModelId, ToneOverride, Platform } from '../lib/types.js';

const PLATFORM_RULES: Record<Platform, string> = {
  instagram: 'Instagram: engaging, hashtag-friendly, 125-150 chars for caption, can be longer for carousel. Casual, visual storytelling.',
  x: 'X (Twitter): concise, punchy, under 280 characters. Witty or informative. Use line breaks for readability.',
  facebook: 'Facebook: conversational, 1-2 short paragraphs. Can be longer. Community-focused.',
  linkedin: 'LinkedIn: professional tone, value-driven, 1-3 sentences. No emoji overload. Thought leadership.',
  tiktok: 'TikTok: trending, hook in first line, short and punchy. Casual, Gen Z friendly.',
};

interface BrandVoiceSummary {
  accountType?: string;
  niche?: string;
  targetAudience?: string;
  toneTags?: string[];
  toneSliders?: { casualProfessional: number; playfulSerious: number; shortDetailed: number };
}

export function buildCaptionPrompt(
  platform: Platform,
  topic: string,
  toneOverride: ToneOverride,
  brandVoice?: BrandVoiceSummary | null
): string {
  const rules = PLATFORM_RULES[platform];
  const tone =
    toneOverride === 'auto' && brandVoice?.toneTags?.length
      ? `Tone: ${brandVoice.toneTags.join(', ')}. `
      : toneOverride !== 'auto'
        ? `Tone override: ${toneOverride}. `
        : '';
  const context =
    brandVoice?.niche || brandVoice?.targetAudience
      ? `Niche: ${brandVoice.niche ?? 'general'}. Target audience: ${brandVoice.targetAudience ?? 'general'}. `
      : '';
  return `You are a social media copywriter. Generate exactly 3 distinct caption variations for the following.

Platform: ${rules}

${tone}${context}

Topic/context: ${topic}

Requirements:
- Output exactly 3 captions.
- Format: number each as "1.", "2.", "3." on a new line. No other labels.
- Each caption must be different in angle, hook, or tone.
- Follow the platform rules above for length and style.`;
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.8,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from OpenAI');
  return content;
}

async function generateWithGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.8 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error('Empty response from Gemini');
  return content;
}

async function generateWithClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const content = data.content?.find((b) => b.type === 'text')?.text?.trim();
  if (!content) throw new Error('Empty response from Anthropic');
  return content;
}

export async function generateCaptions(
  modelId: TextModelId,
  prompt: string
): Promise<string[]> {
  let content: string;

  switch (modelId) {
    case 'gpt-4o':
      content = await generateWithOpenAI(prompt);
      break;
    case 'gemini-1.5-flash':
      content = await generateWithGemini(prompt);
      break;
    case 'claude-3.5-haiku':
      content = await generateWithClaude(prompt);
      break;
    default:
      throw new Error(`Unknown model: ${modelId}`);
  }

  const variations = content
    .split(/\n*\s*\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (variations.length < 3) {
    return [variations[0] ?? content, variations[1] ?? content, variations[2] ?? content].slice(0, 3);
  }
  return variations.slice(0, 3);
}
