import React, { createContext, useContext, useState } from 'react';
import { AnalysisResult } from '@/types/app';

// Holds the most recent analysis result so the results screen can access it
// without needing to re-fetch from the backend.

interface AnalysisContextType {
  result: AnalysisResult | null;
  setResult: (result: AnalysisResult) => void;
  clear: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [result, setResultState] = useState<AnalysisResult | null>(null);

  const setResult = (r: AnalysisResult) => setResultState(r);
  const clear = () => setResultState(null);

  return (
    <AnalysisContext.Provider value={{ result, setResult, clear }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider');
  return ctx;
}
