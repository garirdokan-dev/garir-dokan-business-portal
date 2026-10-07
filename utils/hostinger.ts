/**
 * Connection to the Hostinger database.
 *
 * The live portal (portal.garirdokan.com) saves everything in the portal's own database on the
 * Hostinger VPS, through the portal API at /api on the same website - there is no separate
 * address or key. Images and PDFs that arrive as data URLs are stored by the server as real
 * files in /var/www/portal/uploads, and the database keeps only their /uploads/... links.
 *
 * Anywhere else (the AI Studio preview, localhost) the connection is switched off and the app
 * works from this browser's storage only, so testing a change never touches real business data.
 */

export const isHostingerConfigured =
  typeof window !== 'undefined' && /(^|\.)garirdokan\.com$/i.test(window.location.hostname);

const API_BASE = '/api';

/** Sent when the server says the login is missing or expired; the app then shows the login page. */
export const LOGIN_REQUIRED_EVENT = 'portal:login-required';
/** Sent right after a successful login, so parts of the app can refresh from the server. */
export const LOGGED_IN_EVENT = 'portal:logged-in';

const signalIfLoggedOut = (status: number) => {
  if (status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event(LOGIN_REQUIRED_EVENT));
};

export type HostingerTable = 'documents' | 'assets';

const request = async <T>(method: 'GET' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    signalIfLoggedOut(response.status);
    let detail = '';
    try {
      const data = await response.json();
      if (data && data.error) detail = `: ${data.error}`;
    } catch {
      /* the error response had no JSON body */
    }
    throw new Error(`Hostinger database: ${method} ${path} failed (${response.status})${detail}`);
  }
  return (await response.json()) as T;
};

const enc = encodeURIComponent;

/** True when a stored preference holds something. An empty object marks a removed one. */
export const hasContent = (value: unknown): boolean =>
  value !== null && typeof value === 'object' && Object.keys(value as object).length > 0;

// Same test the server uses to recognise an embedded image or PDF.
const DATA_URL_RE = /^data:([^;,]+)?(;base64)?,/i;

/** Stores one data-URL image or PDF as a file on the server and returns its /uploads link. */
const uploadDataUrl = async (dataUrl: string): Promise<string> => {
  const blob = await (await fetch(dataUrl)).blob();
  const response = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
    credentials: 'same-origin',
  });
  if (!response.ok) {
    signalIfLoggedOut(response.status);
    throw new Error(`Hostinger database: uploading a file failed (${response.status})`);
  }
  const stored = (await response.json()) as { url: string };
  return stored.url;
};

/*
 * The server turns data-URL *values* into /uploads links by itself, but the database cannot
 * store a data URL used as a *name* (an object key) - for example the hero banner's
 * imagePositions, which are keyed by image. Such keys are uploaded first and replaced by their
 * link. It is the same link the server gives the matching value, so keys and values still match.
 */
const rekeyDataUrls = async (value: unknown): Promise<unknown> => {
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) out.push(await rekeyDataUrls(item));
    return out;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      const name = DATA_URL_RE.test(key) ? await uploadDataUrl(key) : key;
      out[name] = await rekeyDataUrls(inner);
    }
    return out;
  }
  return value;
};

export const hostinger = {
  /** Every row of a table, newest first. */
  list: <T>(table: HostingerTable) => request<T[]>('GET', `/${table}`),
  /** Insert or replace one row. Returns the stored copy, with images turned into /uploads links. */
  save: async <T>(table: HostingerTable, id: string, data: T) =>
    request<T>('PUT', `/${table}/${enc(id)}`, await rekeyDataUrls(data)),
  remove: (table: HostingerTable, id: string) => request<{ deleted: boolean }>('DELETE', `/${table}/${enc(id)}`),

  /** One preference by id, or null when it was never saved. */
  getPreference: <T>(id: string) => request<T | null>('GET', `/preferences/${enc(id)}`),
  savePreference: async <T>(id: string, data: T) =>
    request<T>('PUT', `/preferences/${enc(id)}`, await rekeyDataUrls(data)),
  /** The API has no delete for preferences, so an empty object marks one as removed. */
  clearPreference: (id: string) => request<unknown>('PUT', `/preferences/${enc(id)}`, {}),
};
