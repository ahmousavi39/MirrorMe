// ── Clothing item returned by Ximilar ────────────────────────────────────────────
export interface ClothingItem {
  category: string;
  color: string | null;
  material: string | null;
  pattern: string | null;
  fit: string | null;
  style: string | null;
  tags: string[];
}

// ── Full analysis result returned by /api/analyze ────────────────────────────────
export interface AnalysisResult {
  uploadId: string;
  score: number;
  feedback: string;
  suggestions: string[];
  clothingItems: ClothingItem[];
  uploadsUsedThisWeek: number;
  uploadsLimitPerWeek: number;
  remainingFreeUploads: number | null;
  isSubscribed: boolean;
}

// ── History entry stored in Firestore ────────────────────────────────────────────
export interface HistoryItem {
  id: string;
  score: number;
  feedback: string;
  suggestions: string[];
  clothingItems: ClothingItem[];
  weekKey: string;
  createdAt: string;
}

// ── Subscription status returned by /api/subscription/status ─────────────────────
export interface SubscriptionStatus {
  isSubscribed: boolean;
  uploadsUsedThisWeek: number;
  uploadsLimitPerWeek: number;
  remainingFreeUploads: number | null;
}