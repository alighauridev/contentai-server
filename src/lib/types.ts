export type Platform = 'instagram' | 'x' | 'facebook' | 'linkedin' | 'tiktok';
export type TextModelId = 'gpt-4o' | 'gemini-1.5-flash' | 'claude-3.5-haiku';
export type ImageModelId = 'flux' | 'sdxl' | 'dalle3' | 'gemini-imagen';
export type ToneOverride = 'auto' | 'casual' | 'professional' | 'funny' | 'inspiring';
export type AspectRatio = '1:1' | '4:5' | '9:16';
export type ImageStyle = 'photorealistic' | 'artistic' | '3d';

export interface BrandVoiceBody {
  accountType: 'brand' | 'creator' | 'business';
  brandName?: string;
  niche?: string;
  targetAudience?: string;
  website?: string;
  platforms: Platform[];
  toneTags: string[];
  toneSliders: {
    casualProfessional: number;
    playfulSerious: number;
    shortDetailed: number;
  };
}

export interface CaptionGenerateBody {
  platform: Platform;
  topic: string;
  textModelId: TextModelId;
  toneOverride: ToneOverride;
}

export interface ImageGenerateBody {
  prompt: string;
  imageModelId: ImageModelId;
  aspectRatio: AspectRatio;
  style: ImageStyle;
  numImages?: 1 | 2 | 3;
}

export interface CreatePostBody {
  platform: Platform;
  selectedCaption: string;
  imageUrl?: string;
  templateId?: string;
}
