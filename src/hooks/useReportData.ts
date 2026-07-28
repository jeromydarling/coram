import { useMemo } from 'react';
import { useAnchors } from './useAnchors';
import { useOpportunities } from './useOpportunities';
import { useAnchorPipeline } from './useAnchorPipeline';
import { useEvents } from './useEvents';
import { useMetros } from './useMetros';
import { useRegions } from './useRegions';
import { ReportData, KPIData, TableData, HighlightData } from '@/lib/reportPdf';
import { addDays, subDays, isAfter, isBefore, parseISO, format } from 'date-fns';

interface UseReportDataOptions {
  regionId?: string;
  metroId?: string;
  reportType: 'executive' | 'regional' | 'forecast';
}

export function useReportData({ regionId, metroId, reportType }: UseReportDataOptions) {
  const { data: anchors } = useAnchors();
  const { data: opportunities } = useOpportunities();
  const { data: pipeline } = useAnchorPipeline();
  const { data: events } = useEvents();
  const { data: metros } = useMetros();
  const { data: regions } = useRegions();

  const filteredData = useMemo(() => {
    if (!anchors || !opportunities || !pipeline || !events || !metros) {
      return null;
    }

    // Filter by region/metro if specified
    let filteredMetroIds: string[] | null = null;
    
    if (metroId) {
      filteredMetroIds = [metroId];
    } else if (regionId) {
      filteredMetroIds = metros
        .filter(m => m.region_id === regionId)
        .map(m => m.id);
    }

    const filterByMetro = <T extends { metro_id?: string | null }>(items: T[]): T[] => {
      if (!filteredMetroIds) return items;
      return items.filter(item => item.metro_id && filteredMetroIds!.includes(item.metro_id));
    };

    return {
      anchors: filterByMetro(anchors),
      opportunities: filterByMetro(opportunities),
      pipeline: filterByMetro(pipeline),
      events: filterByMetro(events),
      metros: filteredMetroIds 
        ? metros.filter(m => filteredMetroIds!.includes(m.id))
        : metros,
    };
  }, [anchors, opportunities, pipeline, events, metros, regionId, metroId]);

  const reportData = useMemo(() => {
    if (!filteredData) return null;

    const today = new Date();
    const region = regions?.find(r => r.id === regionId);
    const metro = metros?.find(m => m.id === metroId);

    // Calculate KPIs
    const activeAnchors = filteredData.anchors.filter(a => a.first_volume_date).length;
    const newAnchorsThisMonth = filteredData.anchors.filter(a => {
      if (!a.first_volume_date) return false;
      const date = parseISO(a.first_volume_date);
      return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }).length;

    const activeOpportunities = filteredData.opportunities.filter(o => o.status === 'Active').length;
    const pipelineDeals = filteredData.pipeline.length;
    
    const totalVolume = filteredData.anchors.reduce((sum, a) => sum + (a.avg_monthly_volume || 0), 0);

    // Forecast calculations
    const pipelineByStage = filteredData.pipeline.reduce((acc, p) => {
      acc[p.stage || 'Unknown'] = (acc[p.stage || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const forecast30Days = filteredData.pipeline.filter(p => {
      if (!p.target_first_volume_date) return false;
      const target = parseISO(p.target_first_volume_date);
      return isAfter(target, today) && isBefore(target, addDays(today, 30));
    });

    const forecast60Days = filteredData.pipeline.filter(p => {
      if (!p.target_first_volume_date) return false;
      const target = parseISO(p.target_first_volume_date);
      return isAfter(target, addDays(today, 30)) && isBefore(target, addDays(today, 60));
    });

    const forecast90Days = filteredData.pipeline.filter(p => {
      if (!p.target_first_volume_date) return false;
      const target = parseISO(p.target_first_volume_date);
      return isAfter(target, addDays(today, 60)) && isBefore(target, addDays(today, 90));
    });

    // Highlights - recent wins
    const recentAnchors = filteredData.anchors
      .filter(a => a.first_volume_date && isAfter(parseISO(a.first_volume_date), subDays(today, 30)))
      .slice(0, 5);

    const recentEvents = filteredData.events
      .filter(e => e.event_date && isAfter(parseISO(e.event_date), subDays(today, 30)))
      .slice(0, 5);

    // Build report sections based on type
    const sections: ReportData['sections'] = [];

    // KPI Section
    const kpis: KPIData[] = [
      { label: 'Active Anchors', value: activeAnchors, change: `+${newAnchorsThisMonth} this month`, trend: 'up' as const },
      { label: 'Active Opportunities', value: activeOpportunities },
      { label: 'Pipeline Deals', value: pipelineDeals },
      { label: 'Monthly Volume', value: totalVolume.toLocaleString() },
    ];
    sections.push({ type: 'kpi', title: 'Key Performance Indicators', data: kpis });

    // Forecast section
    if (reportType === 'forecast' || reportType === 'executive') {
      const forecastKpis: KPIData[] = [
        { label: '30-Day Forecast', value: forecast30Days.length, change: 'Expected anchors' },
        { label: '60-Day Forecast', value: forecast60Days.length, change: 'Expected anchors' },
        { label: '90-Day Forecast', value: forecast90Days.length, change: 'Expected anchors' },
        { label: 'Total Pipeline Value', value: `$${(forecast30Days.length + forecast60Days.length + forecast90Days.length) * 5000}` },
      ];
      sections.push({ type: 'kpi', title: 'Anchor Forecast', data: forecastKpis });

      // Forecast table
      const forecastItems = [...forecast30Days, ...forecast60Days, ...forecast90Days]
        .slice(0, 10)
        .map(p => {
          const opp = filteredData.opportunities.find(o => o.id === p.opportunity_id);
          const m = metros?.find(mt => mt.id === p.metro_id);
          return [
            opp?.organization || 'Unknown',
            m?.metro || 'Unknown',
            p.stage || 'Unknown',
            p.target_first_volume_date ? format(parseISO(p.target_first_volume_date), 'MMM d, yyyy') : 'TBD',
            `${p.probability || 0}%`,
          ];
        });

      if (forecastItems.length > 0) {
        sections.push({
          type: 'table',
          title: 'Upcoming Anchor Conversions',
          data: {
            headers: ['Organization', 'Metro', 'Stage', 'Target Date', 'Probability'],
            rows: forecastItems,
          } as TableData,
        });
      }
    }

    // Pipeline breakdown
    if (reportType === 'executive' || reportType === 'regional') {
      const pipelineRows = Object.entries(pipelineByStage).map(([stage, count]) => [stage, count]);
      if (pipelineRows.length > 0) {
        sections.push({
          type: 'table',
          title: 'Pipeline by Stage',
          data: {
            headers: ['Stage', 'Count'],
            rows: pipelineRows,
          } as TableData,
        });
      }
    }

    // Highlights / Good News
    const highlights: HighlightData[] = [];
    
    recentAnchors.forEach(anchor => {
      const opp = filteredData.opportunities.find(o => o.id === anchor.opportunity_id);
      if (opp) {
        highlights.push({
          title: `New Anchor: ${opp.organization}`,
          description: `Started producing volume on ${anchor.first_volume_date ? format(parseISO(anchor.first_volume_date), 'MMM d') : 'recently'}`,
          metric: `${anchor.avg_monthly_volume || 0}/mo`,
        });
      }
    });

    recentEvents.forEach(event => {
      if ((event.households_served || 0) > 50) {
        highlights.push({
          title: event.event_name,
          description: `Successful event on ${format(parseISO(event.event_date), 'MMM d')}`,
          metric: `${event.households_served} HH`,
        });
      }
    });

    if (highlights.length > 0) {
      sections.push({
        type: 'highlight',
        title: 'Recent Wins & Good News',
        data: highlights.slice(0, 6),
      });
    }

    // Top opportunities table
    const topOpps = filteredData.opportunities
      .filter(o => o.status === 'Active')
      .slice(0, 8)
      .map(o => {
        const m = metros?.find(mt => mt.id === o.metro_id);
        return [
          o.organization,
          m?.metro || 'Unknown',
          o.stage || 'Unknown',
          o.next_step || '-',
        ];
      });

    if (topOpps.length > 0) {
      sections.push({
        type: 'table',
        title: 'Active Opportunities',
        data: {
          headers: ['Organization', 'Metro', 'Stage', 'Next Step'],
          rows: topOpps,
        } as TableData,
      });
    }

    const reportTitle = reportType === 'forecast' 
      ? '90-Day Anchor Forecast' 
      : reportType === 'regional' 
        ? `Regional Performance Report${region ? `: ${region.name}` : ''}`
        : 'Executive Summary Report';

    return {
      title: reportTitle,
      subtitle: metro?.metro || region?.name || 'All Regions',
      region: region?.name,
      metro: metro?.metro,
      sections,
    };
  }, [filteredData, metros, regions, regionId, metroId, reportType]);

  return {
    isLoading: !anchors || !opportunities || !pipeline || !events || !metros,
    reportData,
    regions,
    metros: filteredData?.metros || metros,
  };
}
