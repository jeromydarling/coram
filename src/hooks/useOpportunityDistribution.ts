import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PARTNER_TIERS = ['Anchor', 'Distribution', 'Referral', 'Workforce', 'Housing', 'Education', 'Other'] as const;
const GRANT_ALIGNMENTS = ['Digital Equity', 'Workforce Development', 'Housing Stability', 'Education', 'Refugee Services'] as const;

const TIER_COLORS: Record<string, string> = {
  'Anchor': 'hsl(var(--accent))',
  'Distribution': 'hsl(var(--primary))',
  'Referral': 'hsl(var(--info))',
  'Workforce': 'hsl(var(--warning))',
  'Housing': 'hsl(var(--success))',
  'Education': 'hsl(var(--chart-5))',
  'Other': 'hsl(var(--muted-foreground))'
};

const GRANT_COLORS: Record<string, string> = {
  'Digital Equity': 'hsl(217, 91%, 50%)',
  'Workforce Development': 'hsl(38, 92%, 50%)',
  'Housing Stability': 'hsl(142, 71%, 45%)',
  'Education': 'hsl(280, 60%, 55%)',
  'Refugee Services': 'hsl(199, 89%, 48%)'
};

export interface DistributionData {
  name: string;
  count: number;
  color: string;
}

export function usePartnerTierDistribution() {
  return useQuery({
    queryKey: ['partner-tier-distribution'],
    queryFn: async () => {
      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('partner_tier, partner_tiers');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      PARTNER_TIERS.forEach(tier => { counts[tier] = 0; });
      
      (opportunities || []).forEach(opp => {
        const tiers = opp.partner_tiers?.length ? opp.partner_tiers : [opp.partner_tier || 'Other'];
        tiers.forEach((tier: string) => {
          if (counts.hasOwnProperty(tier)) {
            counts[tier]++;
          }
        });
      });
      
      return PARTNER_TIERS.map(tier => ({
        name: tier,
        count: counts[tier],
        color: TIER_COLORS[tier]
      })).filter(d => d.count > 0);
    }
  });
}

export function useGrantAlignmentDistribution() {
  return useQuery({
    queryKey: ['grant-alignment-distribution'],
    queryFn: async () => {
      // Fetch opportunities and grant alignments lookup in parallel
      const [oppResult, grantsResult] = await Promise.all([
        supabase.from('opportunities').select('grant_alignment'),
        supabase.from('grant_alignments').select('name, color').eq('is_active', true).order('sort_order')
      ]);
      
      if (oppResult.error) throw oppResult.error;
      if (grantsResult.error) throw grantsResult.error;
      
      const opportunities = oppResult.data || [];
      const grantAlignments = grantsResult.data || [];
      
      // Build color map from lookup table
      const colorMap: Record<string, string> = {};
      const defaultColors = [
        'hsl(217, 91%, 50%)',
        'hsl(38, 92%, 50%)',
        'hsl(142, 71%, 45%)',
        'hsl(280, 60%, 55%)',
        'hsl(199, 89%, 48%)',
        'hsl(25, 95%, 53%)',
        'hsl(340, 80%, 55%)'
      ];
      
      grantAlignments.forEach((g, i) => {
        colorMap[g.name] = g.color || defaultColors[i % defaultColors.length];
      });
      
      // Count occurrences of each grant alignment
      const counts: Record<string, number> = {};
      
      opportunities.forEach(opp => {
        (opp.grant_alignment || []).forEach((grant: string) => {
          counts[grant] = (counts[grant] || 0) + 1;
        });
      });
      
      // Return all grants that have counts > 0
      return Object.entries(counts)
        .map(([name, count]) => ({
          name,
          count,
          color: colorMap[name] || 'hsl(var(--muted-foreground))'
        }))
        .sort((a, b) => b.count - a.count);
    }
  });
}
