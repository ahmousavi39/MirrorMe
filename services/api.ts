import { auth } from './firebase';
import { BACKEND_URL } from '@/constants/config';
import { AnalysisResult, HistoryItem, SubscriptionStatus, WardrobeItem } from '@/types/app';

// ── Auth helper ───────────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function authHeaders() {
  const token = await getToken();
  return { Authorization: `Bearer ${token}` };
}

// ── POST /api/analyze ─────────────────────────────────────────────────────────────
// Sends a photo to the backend for Ximilar + Gemini analysis.
export async function analyzePhoto(
  imageUri: string,
  mimeType: string = 'image/jpeg',
  occasion: string | null = null,
  options: { shareWardrobe?: boolean; addToWardrobe?: boolean } = {},
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const headers = await authHeaders();

  const formData = new FormData();
  formData.append('photo', {
    uri: imageUri,
    type: mimeType,
    name: 'photo.jpg',
  } as unknown as Blob);
  if (occasion) formData.append('occasion', occasion);
  formData.append('shareWardrobe', String(options.shareWardrobe ?? true));
  formData.append('addToWardrobe', String(options.addToWardrobe ?? true));

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      ...headers,
    },
    body: formData,
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || data.error || 'Analysis failed') as any;
    err.status = response.status;
    err.code = data.code;
    throw err;
  }
  return data as AnalysisResult;
}

// ── GET /api/subscription/status ─────────────────────────────────────────────────
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const headers = await authHeaders();
  const response = await fetch(`${BACKEND_URL}/api/subscription/status`, { headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get subscription status');
  return data as SubscriptionStatus;
}

// ── GET /api/user/history ─────────────────────────────────────────────────────────
export async function getHistory(): Promise<HistoryItem[]> {
  const headers = await authHeaders();
  const response = await fetch(`${BACKEND_URL}/api/user/history`, { headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to get history');
  return (data.uploads || []) as HistoryItem[];
}

// ── POST /api/user/init ───────────────────────────────────────────────────────────
// Called on first login to create the Firestore user document.
export async function initUser(): Promise<{ isNewUser: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/user/init`, { method: 'POST', headers });
  if (!res.ok) return { isNewUser: false };
  return res.json();
}

// ── POST /api/user/profile ────────────────────────────────────────────────────────
export interface UserProfile {
  name: string;
  sex: 'male' | 'female' | 'other' | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  styleCategories: string[];
}

export async function getProfile(): Promise<Partial<UserProfile>> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/user/profile`, { headers });
  if (!res.ok) return {};
  const data = await res.json();
  return {
    name: data.name ?? '',
    sex: data.sex ?? null,
    age: data.age ?? null,
    heightCm: data.heightCm ?? null,
    weightKg: data.weightKg ?? null,
    styleCategories: data.styleCategories ?? [],
  };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/user/profile`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to save profile');
}

// ── GET/PATCH /api/user/settings ──────────────────────────────────────────────────
export interface AppSettings {
  shareWardrobe: boolean;
  addToWardrobe: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/user/settings`, { headers });
  if (!res.ok) return { shareWardrobe: true, addToWardrobe: true };
  return res.json();
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${BACKEND_URL}/api/user/settings`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

// ── GET /api/wardrobe ─────────────────────────────────────────────────────────────
export async function getWardrobe(): Promise<WardrobeItem[]> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/wardrobe`, { headers });
  if (!res.ok) throw new Error('Failed to fetch wardrobe');
  const data = await res.json();
  return (data.items || []) as WardrobeItem[];
}

// ── PATCH /api/wardrobe/:id ───────────────────────────────────────────────────────
export interface WardrobeItemUpdate {
  category?: string;
  color?: string | null;
  fit?: string | null;
  material?: string | null;
  pattern?: string | null;
  style?: string | null;
  source?: 'results' | 'wardrobe';
}

export async function updateWardrobeItem(id: string, fields: WardrobeItemUpdate): Promise<WardrobeItem> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/wardrobe/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update wardrobe item');
  return data.item as WardrobeItem;
}

// ── DELETE /api/wardrobe/:id ──────────────────────────────────────────────────────
export async function deleteWardrobeItem(id: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/wardrobe/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete wardrobe item');
}

// ── POST /api/wardrobe/add ────────────────────────────────────────────────────────
export async function addWardrobeItem(imageUri: string): Promise<WardrobeItem> {
  const headers = await authHeaders();
  const formData = new FormData();
  formData.append('photo', { uri: imageUri, type: 'image/jpeg', name: 'photo.jpg' } as unknown as Blob);
  const res = await fetch(`${BACKEND_URL}/api/wardrobe/add`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to add wardrobe item') as any;
    err.code = data.code;
    throw err;
  }
  return data.item as WardrobeItem;
}
