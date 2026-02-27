import { SessionOptions } from 'iron-session';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'opps-secret-key-32chars-minimum!!',
  cookieName: 'opps-session',
  cookieOptions: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};

export type SessionData = {
  userId: number;
  email: string;
  role: string;
  orgId: number | null;
};
