import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').unique(),
  email: text('email'),
  displayName: text('display_name'),
  passwordHash: text('password_hash'),
  onboardingCompleted: integer('onboarding_completed').notNull().default(0),
  creditsBalance: integer('credits_balance').notNull().default(10),
  creditsResetMonth: text('credits_reset_month'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const brandVoice = pgTable('brand_voice', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  accountType: text('account_type').notNull(),
  brandName: text('brand_name'),
  niche: text('niche'),
  targetAudience: text('target_audience'),
  website: text('website'),
  platforms: jsonb('platforms').$type<string[]>().notNull().default([]),
  toneTags: jsonb('tone_tags').$type<string[]>().notNull().default([]),
  toneSliders: jsonb('tone_sliders').$type<{
    casualProfessional: number;
    playfulSerious: number;
    shortDetailed: number;
  }>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  platform: text('platform').notNull(),
  selectedCaption: text('selected_caption').notNull(),
  imageUrl: text('image_url'),
  templateId: text('template_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const usage = pgTable('usage', {
  userId: text('user_id').notNull(),
  month: text('month').notNull(),
  captionCount: integer('caption_count').notNull().default(0),
  imageCount: integer('image_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.month] })]);

export type UserRow = typeof users.$inferSelect;
export type BrandVoiceRow = typeof brandVoice.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type UsageRow = typeof usage.$inferSelect;
