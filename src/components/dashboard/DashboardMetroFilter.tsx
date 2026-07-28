import { useTranslation } from 'react-i18next';
import { useMetroIntelligence } from '@/hooks/useMetroIntelligence';
import { useMetros } from '@/hooks/useMetros';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardMetroFilterProps {
  selectedMetroId: string | null;
  onMetroChange: (metroId: string | null) => void;
}

export function DashboardMetroFilter({ selectedMetroId, onMetroChange }: DashboardMetroFilterProps) {
  const { t } = useTranslation('dashboard');
  const { enabled: metroEnabled } = useMetroIntelligence();
  const { data: metros, isLoading } = useMetros();

  // Hide entirely when Metro Intelligence is off
  if (!metroEnabled) return null;

  return (
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4 text-muted-foreground" />
      <Select
        value={selectedMetroId || 'all'}
        onValueChange={(value) => onMetroChange(value === 'all' ? null : value)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={t('metroFilter.allMetros')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('metroFilter.allMetros')}</SelectItem>
          {metros?.map((metro) => (
            <SelectItem key={metro.id} value={metro.id}>
              {metro.metro}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedMetroId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMetroChange(null)}
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
