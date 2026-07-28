import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Loader2,
  Settings
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/components/ui/sonner';

interface GoogleCalendarSyncProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => Promise<void>;
  lastSyncedAt?: string;
}

export function GoogleCalendarSync({
  isConnected,
  onConnect,
  onDisconnect,
  onSync,
  lastSyncedAt
}: GoogleCalendarSyncProps) {
  const { t } = useTranslation('calendar');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSync();
      toast.success(t('googleSync.syncSuccess'));
    } catch (error) {
      toast.error(t('googleSync.syncError'));
    } finally {
      setIsSyncing(false);
    }
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isConnected ? (
            <>
              <Cloud className="w-4 h-4 text-success" />
              {t('googleSync.googleSync')}
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4 text-muted-foreground" />
              {t('googleSync.connectGoogle')}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{t('googleSync.googleCalendar')}</h4>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? t('googleSync.connected') : t('googleSync.disconnected')}
            </Badge>
          </div>

          {isConnected ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('googleSync.syncedDescription')}
              </p>

              {lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  {t('googleSync.lastSynced', { time: new Date(lastSyncedAt).toLocaleString() })}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {t('googleSync.syncNow')}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={onDisconnect}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t('googleSync.notConnectedDescription')}
              </p>

              <Button
                className="w-full gap-2"
                onClick={onConnect}
              >
                <Cloud className="w-4 h-4" />
                {t('googleSync.connectGoogleCalendar')}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
