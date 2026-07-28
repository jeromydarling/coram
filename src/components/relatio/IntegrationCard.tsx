/**
 * IntegrationCard — Displays an integration tile in the Relatio Marketplace.
 *
 * WHAT: Card showing integration name, description, status, and actions.
 * WHERE: Used in RelatioMarketplace grid.
 * WHY: Provides a human-first way to browse and connect integrations.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: string;
  isTwoWay: boolean;
  status?: 'connected' | 'disconnected' | 'error' | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onImport?: () => void;
}

export function IntegrationCard({
  name,
  description,
  icon,
  isTwoWay,
  status,
  onConnect,
  onDisconnect,
  onImport,
}: IntegrationCardProps) {
  // Dynamically resolve icon
  const iconKey = icon.replace(/-./g, x => x[1].toUpperCase()).replace(/^./, x => x.toUpperCase());
  const IconComponent = (iconKey in LucideIcons
    ? (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconKey]
    : LucideIcons.Plug) || LucideIcons.Plug;

  const isConnected = status === 'connected';

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <IconComponent className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {isTwoWay && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    <ArrowLeftRight className="h-3 w-3" />
                    Two-way
                  </span>
                )}
                {status && <ConnectionStatusBadge status={status} />}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-sm">{description}</CardDescription>
        <div className="flex gap-2">
          {!isConnected ? (
            <Button size="sm" onClick={onConnect} className="rounded-full">
              Connect <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          ) : (
            <>
              {onImport && (
                <Button size="sm" onClick={onImport} className="rounded-full">
                  Import
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={onDisconnect}
                className="rounded-full"
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
