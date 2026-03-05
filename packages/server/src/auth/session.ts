import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload {
  accountId: string;
}

export function createSessionToken(accountId: string): string {
  return jwt.sign({ accountId }, JWT_SECRET, { expiresIn: SESSION_DURATION_S });
}

export function validateSessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & SessionPayload;
    if (!decoded.accountId) return null;
    return { accountId: decoded.accountId };
  } catch {
    return null;
  }
}
