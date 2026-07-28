import { useState, useEffect, useCallback } from 'react';

export interface DashboardCard {
  id: string;
  title: string;
}

const DEFAULT_LAYOUT: DashboardCard[] = [
  { id: 'alerts', title: 'Alerts' },
  { id: 'recommendations', title: 'Recommendations' },
  { id: 'discovery', title: 'Discovery Briefings' },
  { id: 'kpi-primary', title: 'Primary KPIs' },
  { id: 'kpi-secondary', title: 'Secondary KPIs' },
  { id: 'grant-kpis', title: 'Grant Metrics' },
  { id: 'anchor-trends', title: 'Anchor Trends' },
  { id: 'pipeline-tier', title: 'Pipeline & Partner Tiers' },
  { id: 'grant-charts', title: 'Grant Charts' },
  { id: 'grant-distribution', title: 'Grant Alignment' },
  { id: 'tables', title: 'Metro & Anchor Tables' },
];

const STORAGE_KEY = 'dashboard-layout';

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardCard[]>(DEFAULT_LAYOUT);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that all default cards exist
        const savedIds = parsed.map((c: DashboardCard) => c.id);
        const defaultIds = DEFAULT_LAYOUT.map(c => c.id);
        
        // If layout is valid and has all cards, use it
        if (defaultIds.every(id => savedIds.includes(id))) {
          setLayout(parsed);
        }
      } catch {
        // Invalid JSON, use default
      }
    }
  }, []);

  const reorder = useCallback((startIndex: number, endIndex: number) => {
    setLayout(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      
      return result;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { layout, reorder, resetLayout };
}
