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

// ── Occasion the user is styling for ────────────────────────────────────────────
export type Occasion =
  | 'casual'
  | 'work'
  | 'date'
  | 'night_out'
  | 'interview'
  | 'formal'
  | 'sport'
  | 'travel'
  | 'school';

// ── Full analysis result returned by /api/analyze ────────────────────────────────
export interface AnalysisResult {
  uploadId: string;
  score: number;
  feedback: string;
  styleTips: string[];
  styleTipItems?: (string | null)[];
  occasionTips: string[];
  occasionTipItems?: (string | null)[];
  clothingItems: ClothingItem[];
  clothingItemsLocalized?: ClothingItem[] | null;
  clothingItemKeys?: (string | null)[];
  occasion: Occasion | null;
  occasionScores: Record<Occasion, number>;
  colorPalette: string[];
  imageUrl?: string | null;
  totalUploadsUsed: number | null;
  totalUploadsLimit: number | null;
  remainingFreeUploads: number | null;
  monthlyUploadsUsed: number | null;
  monthlyUploadsLimit: number | null;
  remainingPremiumUploads: number | null;
  isSubscribed: boolean;
}

// ── History entry stored in Firestore ────────────────────────────────────────────
export interface HistoryItem {
  id: string;
  score: number;
  feedback: string;
  styleTips?: string[];
  styleTipItems?: (string | null)[];
  occasionTips?: string[];
  occasionTipItems?: (string | null)[];
  clothingItems: ClothingItem[];
  clothingItemsLocalized?: ClothingItem[] | null;
  clothingItemKeys?: (string | null)[];
  occasion: Occasion | null;
  occasionScores?: Record<Occasion, number>;
  colorPalette?: string[];
  imageUrl?: string | null;
  weekKey: string;
  createdAt: string;
}

// ── Subscription status returned by /api/subscription/status ─────────────────────
export interface SubscriptionStatus {
  isSubscribed: boolean;
  totalUploadsUsed: number | null;
  totalUploadsLimit: number | null;
  remainingFreeUploads: number | null;
  monthlyUploadsUsed: number | null;
  monthlyUploadsLimit: number | null;
  remainingPremiumUploads: number | null;
}

// ── Localized display fields for a wardrobe item ────────────────────────────────
export interface WardrobeItemLocalized {
  category?: string | null;
  color?: string | null;
  fit?: string | null;
  material?: string | null;
  pattern?: string | null;
  style?: string | null;
}

// ── Wardrobe item stored in Firestore ────────────────────────────────────────────
export interface WardrobeItem {
  id: string;
  category: string;
  color: string | null;
  material: string | null;
  pattern: string | null;
  fit: string | null;
  style: string | null;
  uploadId: string;
  imageUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  timesWorn: number;
  /** Legacy locale overlay (kept for backward compat with items saved before this change) */
  localized?: Record<string, WardrobeItemLocalized> | null;
}