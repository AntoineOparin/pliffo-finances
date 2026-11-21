import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

export const SESSION_SECONDS = 30 * 86400;
const key = (secret: string) => new TextEncoder().encode(secret);

/** `list` is the comma-separated ALLOWED_EMAILS secret. */
export const isAllowed = (email: string, list: string) =>
  list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());

export const signSession = (email: string, secret: string) =>
  new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_SECONDS)
    .sign(key(secret));

/** The email in a valid session cookie, or null. */
export async function readSession(token: string | undefined, secret: string): Promise<string | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

let googleKeys: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Trades Google's one-time code for the user's verified email, or null. */
export async function googleEmail(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  googleKeys ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  try {
    const { payload } = await jwtVerify(id_token, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });
    return payload.email_verified === true && typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
