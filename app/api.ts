import type { Entry, renewals, summarize } from "../src/money";

export type Row = Entry & { id: number; receipt_key: string | null; added_by: string | null };
export type Cat = { id: number; name: string; emoji: string; color: string };
export type Data = {
  me: string;
  entries: Row[];
  categories: Cat[];
  summary: ReturnType<typeof summarize>;
  renewals: ReturnType<typeof renewals<Row>>;
};

/** fetch that sends JSON, sends you to /login when signed out, and throws the server's error message. */
export async function api(path: string, init: Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit } = {}) {
  const { json, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    ...(json !== undefined && { body: JSON.stringify(json), headers: { "Content-Type": "application/json" } }),
  });
  if (res.status === 401) {
    location.assign("/login");
    throw new Error("Signed out");
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
  return res;
}
