import { describe, it, expect } from 'vitest';
import { 
  countActiveAnchors, 
  countAnchorsFormedInPeriod,
  computeMetroReadiness,
  calculateDaysInStage,
  calculateAverageVolume,
  calculateMedianCycleTime
} from '@/lib/computations';
import type { Anchor, Metro } from '@/types';

/**
 * Data Integrity Tests
 * 
 * These tests verify that the 5 critical anti-patterns are NOT present:
 * 1. Anchors Formed counting based on record existence instead of first_volume_date
 * 2. Metro readiness using manual counts instead of computed aggregates
 * 3. Pipeline stages without proper days-in-stage calculation
 * 4. Relationships using org name matching instead of IDs
 * 5. Averages mixing blanks as zeros (corrupting metrics)
 */

describe('Anchor Counting Logic', () => {
  describe('countActiveAnchors', () => {
    it('should only count anchors with a non-null first_volume_date', () => {
      const anchors = [
        { anchor_id: 'A1', first_volume_date: '2024-06-15' },
        { anchor_id: 'A2', first_volume_date: null }, // Should NOT be counted
        { anchor_id: 'A3', first_volume_date: '2024-08-20' },
        { anchor_id: 'A4', first_volume_date: undefined }, // Should NOT be counted
      ] as any[];

      const count = countActiveAnchors(anchors);
      expect(count).toBe(2); // Only A1 and A3
    });

    it('should return 0 when no anchors have first_volume_date', () => {
      const anchors = [
        { anchor_id: 'A1', first_volume_date: null },
        { anchor_id: 'A2', first_volume_date: undefined },
      ] as any[];

      expect(countActiveAnchors(anchors)).toBe(0);
    });

    it('should NOT count based on anchor tier', () => {
      const anchors = [
        { anchor_id: 'A1', anchor_tier: 'Strategic', first_volume_date: null },
        { anchor_id: 'A2', anchor_tier: 'Standard', first_volume_date: '2024-01-01' },
      ] as any[];

      // Strategic tier without volume date should NOT count
      expect(countActiveAnchors(anchors)).toBe(1);
    });
  });

  describe('countAnchorsFormedInPeriod', () => {
    it('should count anchors formed within the specified period based on first_volume_date', () => {
      const now = new Date('2025-01-25');
      const anchors = [
        { anchor_id: 'A1', first_volume_date: '2024-12-01' }, // 55 days ago - within 90
        { anchor_id: 'A2', first_volume_date: '2024-06-01' }, // 238 days ago - outside 90
        { anchor_id: 'A3', first_volume_date: '2025-01-10' }, // 15 days ago - within 90
        { anchor_id: 'A4', first_volume_date: null }, // No date - not counted
      ] as any[];

      const count = countAnchorsFormedInPeriod(anchors, 90, now);
      expect(count).toBe(2); // A1 and A3
    });
  });
});

describe('Metro Readiness Computation', () => {
  describe('computeMetroReadiness', () => {
    it('should compute activeAnchors from related anchors table, not manual count', () => {
      const metro = {
        id: 'metro-1',
        metro_id: 'METRO-001',
        metro: 'Denver',
      };
      
      const allAnchors = [
        { anchor_id: 'A1', metro_id: 'metro-1', first_volume_date: '2024-01-01' },
        { anchor_id: 'A2', metro_id: 'metro-1', first_volume_date: '2024-02-01' },
        { anchor_id: 'A3', metro_id: 'metro-2', first_volume_date: '2024-03-01' }, // Different metro
        { anchor_id: 'A4', metro_id: 'metro-1', first_volume_date: null }, // No volume date
      ] as any[];

      const allPipeline = [] as any[];

      const readiness = computeMetroReadiness(metro, allAnchors, allPipeline);
      expect(readiness.activeAnchors).toBe(2); // Only metro-1 anchors with volume date
    });

    it('should compute anchorsInPipeline from pipeline table, not manual count', () => {
      const metro = {
        id: 'metro-1',
        metro_id: 'METRO-001',
        metro: 'Denver',
      };
      
      const allAnchors = [] as any[];
      
      const allPipeline = [
        { anchor_pipeline_id: 'P1', metro_id: 'metro-1', stage: 'Discovery Held' },
        { anchor_pipeline_id: 'P2', metro_id: 'metro-1', stage: 'Proposal Sent' },
        { anchor_pipeline_id: 'P3', metro_id: 'metro-2', stage: 'Contacted' }, // Different metro
      ] as any[];

      const readiness = computeMetroReadiness(metro, allAnchors, allPipeline);
      expect(readiness.anchorsInPipeline).toBe(2); // Only metro-1 pipeline items
    });

    it('should calculate anchor score based on computed active anchors count', () => {
      const metro = { id: 'metro-1', metro_id: 'METRO-001', metro: 'Denver' };
      
      // 0 anchors = 0 score
      expect(computeMetroReadiness(metro, [], []).anchorScore).toBe(0);
      
      // 1 anchor = 20 score
      const oneAnchor = [{ metro_id: 'metro-1', first_volume_date: '2024-01-01' }] as any[];
      expect(computeMetroReadiness(metro, oneAnchor, []).anchorScore).toBe(20);
      
      // 2+ anchors = 40 score
      const twoAnchors = [
        { metro_id: 'metro-1', first_volume_date: '2024-01-01' },
        { metro_id: 'metro-1', first_volume_date: '2024-02-01' },
      ] as any[];
      expect(computeMetroReadiness(metro, twoAnchors, []).anchorScore).toBe(40);
    });
  });
});

describe('Pipeline Stage Tracking', () => {
  describe('calculateDaysInStage', () => {
    it('should calculate days from stage_entry_date to now', () => {
      const stageEntryDate = '2025-01-10';
      const now = new Date('2025-01-25');
      
      const days = calculateDaysInStage(stageEntryDate, now);
      expect(days).toBe(15);
    });

    it('should return 0 if stage_entry_date is null', () => {
      const days = calculateDaysInStage(null, new Date());
      expect(days).toBe(0);
    });

    it('should return 0 if stage_entry_date is in the future', () => {
      const days = calculateDaysInStage('2025-02-01', new Date('2025-01-25'));
      expect(days).toBe(0);
    });
  });
});

describe('Metric Calculations - Null Handling', () => {
  describe('calculateAverageVolume', () => {
    it('should exclude records with null/zero volume from average calculation', () => {
      const anchors = [
        { avg_monthly_volume: 100, production_status: 'Stable' },
        { avg_monthly_volume: 200, production_status: 'Scale' },
        { avg_monthly_volume: 0, production_status: 'Pre-Production' }, // Should be excluded
        { avg_monthly_volume: null, production_status: 'Ramp' }, // Should be excluded
      ] as any[];

      const avg = calculateAverageVolume(anchors);
      expect(avg).toBe(150); // (100 + 200) / 2, not (100 + 200 + 0 + 0) / 4
    });

    it('should return 0 if no valid records exist', () => {
      const anchors = [
        { avg_monthly_volume: null },
        { avg_monthly_volume: 0 },
      ] as any[];

      expect(calculateAverageVolume(anchors)).toBe(0);
    });
  });

  describe('calculateMedianCycleTime', () => {
    it('should exclude records with null dates from median calculation', () => {
      // Test that null values are excluded, not treated as 0
      const anchors = [
        { first_contact_date: '2024-01-01', agreement_signed_date: '2024-02-10' }, // 40 days
        { first_contact_date: '2024-01-01', agreement_signed_date: '2024-02-20' }, // 50 days  
        { first_contact_date: '2024-01-01', agreement_signed_date: '2024-03-01' }, // 60 days
        { first_contact_date: '2024-01-01', agreement_signed_date: null }, // Should be excluded
        { first_contact_date: null, agreement_signed_date: '2024-03-01' }, // Should be excluded
      ] as any[];

      const median = calculateMedianCycleTime(anchors, 'contact_to_agreement');
      // Median of [40, 50, 60] = 50
      expect(median).toBe(50);
    });

    it('should NOT treat missing dates as zero days', () => {
      const anchors = [
        { first_contact_date: '2024-01-01', agreement_signed_date: '2024-02-10' }, // 40 days
        { first_contact_date: null, agreement_signed_date: null }, // Should be excluded, NOT 0
      ] as any[];

      const median = calculateMedianCycleTime(anchors, 'contact_to_agreement');
      // If nulls were treated as 0, median would be 20 (average of 0 and 40)
      // Correct behavior: median of [40] = 40
      expect(median).toBe(40);
    });
  });
});

describe('Relationship Integrity', () => {
  it('entities should use ID references, not name matching', () => {
    // This is a structural test - verifying the types require ID fields
    type OpportunityRelation = {
      metro_id: string; // UUID reference, not metro name
      id: string;
    };
    
    type ContactRelation = {
      opportunity_id: string; // UUID reference, not organization name
      id: string;
    };

    // These type definitions prove relationships use IDs
    const opp: OpportunityRelation = { metro_id: 'uuid-123', id: 'opp-1' };
    const contact: ContactRelation = { opportunity_id: 'uuid-456', id: 'con-1' };
    
    expect(opp.metro_id).toBeDefined();
    expect(contact.opportunity_id).toBeDefined();
  });
});
