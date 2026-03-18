import { Router } from 'express';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT } from 'jose';
import { db } from '../db/index.js';
import { users, brandVoice } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, type AuthReq } from '../middleware/auth.js';

export const authRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-in-production');
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(':');
  if (!salt || !storedHash) return false;
  const derived = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  try {
    return timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

async function signToken(sub: string): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

function rowToUser(row: typeof users.$inferSelect, bv?: typeof brandVoice.$inferSelect | null) {
  return {
    id: row.id,
    email: row.email ?? undefined,
    displayName: row.displayName ?? undefined,
    onboardingCompleted: Boolean(row.onboardingCompleted),
    brandVoice: bv ? rowToBrandVoice(bv) : undefined,
  };
}

function rowToBrandVoice(row: typeof brandVoice.$inferSelect) {
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

// ─── Routes ──────────────────────────────────────────────────────────────────

/** POST /auth/register — create a new account */
authRouter.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ message: 'Password must be at least 8 characters.' });
    return;
  }

  // Check for duplicate email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (existing) {
    res.status(409).json({ message: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      displayName: displayName?.trim() || null,
      passwordHash,
      onboardingCompleted: 0,
    })
    .returning();

  if (!user) {
    res.status(500).json({ message: 'Failed to create account.' });
    return;
  }

  const token = await signToken(user.id);
  res.status(201).json({ token, user: rowToUser(user) });
});

const TESTER_EMAIL = 'tester@contentai.app';

/** POST /auth/login — sign in with email + password */
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const isTester = normalizedEmail === TESTER_EMAIL;

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  // Tester bypass: auto-create account if it doesn't exist, skip password check
  if (isTester) {
    if (!user) {
      const [created] = await db
        .insert(users)
        .values({ email: TESTER_EMAIL, displayName: 'Tester', passwordHash: hashPassword('tester'), onboardingCompleted: 1 })
        .returning();
      user = created!;
    }
    const [bv] = await db.select().from(brandVoice).where(eq(brandVoice.userId, user.id)).limit(1);
    const token = await signToken(user.id);
    res.json({ token, user: rowToUser(user, bv) });
    return;
  }

  if (!user || !user.passwordHash) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const [bv] = await db.select().from(brandVoice).where(eq(brandVoice.userId, user.id)).limit(1);
  const token = await signToken(user.id);
  res.json({ token, user: rowToUser(user, bv) });
});

/** GET /auth/me — return current user's profile (JWT required) */
authRouter.get('/me', requireAuth, async (req: AuthReq, res) => {
  const userId = req.userId!;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }
  const [bv] = await db.select().from(brandVoice).where(eq(brandVoice.userId, userId)).limit(1);
  res.json({ user: rowToUser(user, bv) });
});
