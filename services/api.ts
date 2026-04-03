import { auth } from './firebase';
import { BACKEND_URL } from '@/constants/config';
import { AnalysisResult, HistoryItem, SubscriptionStatus } from '@/types/app';

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
  mimeType: string = 'image/jpeg'
): Promise<AnalysisResult> {
  const headers = await authHeaders();

  const formData = new FormData();
  formData.append('photo', {
    uri: imageUri,
    type: mimeType,
    name: 'photo.jpg',
  } as unknown as Blob);

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      ...headers,
      // Do NOT set Content-Type — fetch sets it automatically with the multipart boundary
    },
    body: formData,
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
export async function initUser(): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${BACKEND_URL}/api/user/init`, { method: 'POST', headers });
}
