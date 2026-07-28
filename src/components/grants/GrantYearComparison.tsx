import { useMemo, useState } from 'react';
import { useGrants, Grant } from '@/hooks/useGrants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GrantStageBadge } from '@/components/grants/GrantStageBadge';
import { StarRatingControl } from '@/components/grants/StarRatingControl';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  DollarSign, 
  Calendar,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GrantGroup {
  key: string;
  grantName: string;
  funderName: string;
  grants: Grant[];
  yearsSpanned: number[];
}

interface GrantYearComparisonProps {
  onGrantClick?: (grantId: string) => void;
}

export function GrantYearComparison({ onGrantClick }: GrantYearComparisonProps) {
  const { data: grants, isLoading } = useGrants();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFunder, setSelectedFunder] = useState<string>('all');
  
  // Group grants by funder_name + grant_name to find recurring grants
  const grantGroups = useMemo(() => {
    if (!grants) return [];
    
    const groups = new Map<string, GrantGroup>();
    
    grants.forEach(grant => {
      // Create a key based on funder and grant name (normalized)
      const key = `${grant.funder_name.toLowerCase().trim()}::${grant.grant_name.toLowerCase().trim()}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          grantName: grant.grant_name,
          funderName: grant.funder_name,
          grants: [],
          yearsSpanned: []
        });
      }
      
      const group = groups.get(key)!;
      group.grants.push(grant);
      if (grant.fiscal_year && !group.yearsSpanned.includes(grant.fiscal_year)) {
        group.yearsSpanned.push(grant.fiscal_year);
      }
    });
    
    // Only return groups with more than 1 grant (recurring grants)
    return Array.from(groups.values())
      .filter(group => group.grants.length > 1)
      .map(group => ({
        ...group,
        grants: group.grants.sort((a, b) => (b.fiscal_year || 0) - (a.fiscal_year || 0)),
        yearsSpanned: group.yearsSpanned.sort((a, b) => b - a)
      }))
      .sort((a, b) => b.yearsSpanned[0] - a.yearsSpanned[0]);
  }, [grants]);
  
  // Get unique funders for filter
  const funders = useMemo(() => {
    const funderSet = new Set(grantGroups.map(g => g.funderName));
    return Array.from(funderSet).sort();
  }, [grantGroups]);
  
  // Filter by funder
  const filteredGroups = useMemo(() => {
    if (selectedFunder === 'all') return grantGroups;
    return grantGroups.filter(g => g.funderName === selectedFunder);
  }, [grantGroups, selectedFunder]);
  
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  
  const formatCurrency = (amount: number | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      maximumFractionDigits: 0 
    }).format(amount);
  };
  
  const calculateTrend = (current: number | null, previous: number | null) => {
    if (!current || !previous) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      percentage: Math.abs(change).toFixed(0)
    };
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading comparison data...</div>
        </CardContent>
      </Card>
    );
  }
  
  if (filteredGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Year-over-Year Comparison
          </CardTitle>
          <CardDescription>
            Compare recurring grants across fiscal years
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No recurring grants found.</p>
            <p className="text-sm mt-1">
              Grants with the same name and funder across multiple fiscal years will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Year-over-Year Comparison
            </CardTitle>
            <CardDescription>
              {filteredGroups.length} recurring grant{filteredGroups.length !== 1 ? 's' : ''} found
            </CardDescription>
          </div>
          <Select value={selectedFunder} onValueChange={setSelectedFunder}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by funder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Funders</SelectItem>
              {funders.map(funder => (
                <SelectItem key={funder} value={funder}>{funder}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-4">
            {filteredGroups.map(group => {
              const isExpanded = expandedGroups.has(group.key);
              const latestGrant = group.grants[0];
              const previousGrant = group.grants[1];
              
              const awardedTrend = calculateTrend(
                latestGrant.amount_awarded,
                previousGrant?.amount_awarded
              );
              
              return (
                <div 
                  key={group.key}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Header Row */}
                  <div 
                    className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{group.grantName}</h4>
                      <p className="text-sm text-muted-foreground">{group.funderName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1">
                        {group.yearsSpanned.slice(0, 4).map(year => (
                          <Badge key={year} variant="outline" className="text-xs">
                            FY{year}
                          </Badge>
                        ))}
                        {group.yearsSpanned.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{group.yearsSpanned.length - 4}
                          </Badge>
                        )}
                      </div>
                      {awardedTrend && (
                        <div className={cn(
                          "flex items-center gap-1 text-sm font-medium",
                          awardedTrend.direction === 'up' && "text-success",
                          awardedTrend.direction === 'down' && "text-destructive"
                        )}>
                          {awardedTrend.direction === 'up' && <TrendingUp className="w-4 h-4" />}
                          {awardedTrend.direction === 'down' && <TrendingDown className="w-4 h-4" />}
                          {awardedTrend.direction === 'flat' && <Minus className="w-4 h-4" />}
                          {awardedTrend.percentage}%
                        </div>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/20">
                            <th className="text-left p-3 font-medium">Fiscal Year</th>
                            <th className="text-left p-3 font-medium">Stage</th>
                            <th className="text-right p-3 font-medium">Requested</th>
                            <th className="text-right p-3 font-medium">Awarded</th>
                            <th className="text-center p-3 font-medium">Rating</th>
                            <th className="text-right p-3 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.grants.map((grant, idx) => {
                            const prevGrant = group.grants[idx + 1];
                            const yearTrend = prevGrant 
                              ? calculateTrend(grant.amount_awarded, prevGrant.amount_awarded)
                              : null;
                            
                            return (
                              <tr 
                                key={grant.id}
                                className="border-t hover:bg-muted/30 transition-colors"
                              >
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">FY{grant.fiscal_year || '—'}</span>
                                    {idx === 0 && (
                                      <Badge variant="secondary" className="text-xs">Latest</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <GrantStageBadge stage={grant.stage} />
                                </td>
                                <td className="p-3 text-right">
                                  {formatCurrency(grant.amount_requested)}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className={cn(
                                      "font-medium",
                                      grant.amount_awarded && "text-success"
                                    )}>
                                      {formatCurrency(grant.amount_awarded)}
                                    </span>
                                    {yearTrend && (
                                      <span className={cn(
                                        "text-xs",
                                        yearTrend.direction === 'up' && "text-success",
                                        yearTrend.direction === 'down' && "text-destructive"
                                      )}>
                                        {yearTrend.direction === 'up' ? '↑' : yearTrend.direction === 'down' ? '↓' : '—'}
                                        {yearTrend.percentage}%
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex justify-center">
                                    <StarRatingControl value={grant.star_rating} readonly size="sm" />
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onGrantClick?.(grant.id);
                                    }}
                                  >
                                    View
                                    <ArrowRight className="w-3 h-3 ml-1" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      
                      {/* Summary Row */}
                      <div className="p-3 bg-muted/20 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {group.grants.length} years tracked
                          </span>
                          <div className="flex gap-6">
                            <div>
                              <span className="text-muted-foreground">Total Requested: </span>
                              <span className="font-medium">
                                {formatCurrency(
                                  group.grants.reduce((sum, g) => sum + (g.amount_requested || 0), 0)
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Awarded: </span>
                              <span className="font-medium text-success">
                                {formatCurrency(
                                  group.grants.reduce((sum, g) => sum + (g.amount_awarded || 0), 0)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
