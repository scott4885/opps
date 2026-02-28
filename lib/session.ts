import { SessionOptions } from 'iron-session';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'opps-secret-key-32chars-minimum!!',
  cookieName: 'opps-session',
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    // secure: false is correct — app runs over HTTP behind reverse proxy.
    // Set to true if HTTPS is configured on the domain.
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
