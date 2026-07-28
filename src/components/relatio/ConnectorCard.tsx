/**
 * ConnectorCard — Displays a bridge connector in the Relatio Marketplace.
 *
 * WHAT: Card showing connector name, mode, status, and actions.
 * WHERE: RelatioMarketplace grid.
 * WHY: Human-first way to browse and connect integration bridges.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { ArrowRight, ArrowLeftRight, Upload, Database } from 'lucide-react';

interface ConnectorCardProps {
  name: string;
  description: string;
  mode: 'one_way' | 'two_way';
  connectorKey: string;
  status?: 'connected' | 'disconnected' | 'error' | null;
  lastImportAt?: string | null;
  onSetup?: () => void;
  onImport?: () => void;
  onDisconnect?: () => void;
}

export function ConnectorCard({
  name,
  description,
  mode,
  connectorKey,
  status,
  lastImportAt,
  onSetup,
  onImport,
  onDisconnect,
}: ConnectorCardProps) {
  const isConnected = status === 'connected';
  const isCsv = connectorKey === 'csv';
  const Icon = isCsv ? Upload : Database;

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {mode === 'two_way' && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    <ArrowLeftRight className="h-3 w-3" />
                    Two-way
                  </span>
                )}
                {mode === 'one_way' && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Import only
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
        {lastImportAt && (
          <p className="text-xs text-muted-foreground">
            Last import: {new Date(lastImportAt).toLocaleDateString()}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {!isConnected ? (
            <Button size="sm" onClick={onSetup} className="rounded-full">
              Set up <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={onImport} className="rounded-full">
                Run import
              </Button>
              {onDisconnect && (
                <Button size="sm" variant="outline" onClick={onDisconnect} className="rounded-full">
                  Disconnect
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
