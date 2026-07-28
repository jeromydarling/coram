/**
 * OnboardingOrgEnrichmentStep — Org identity URL or PDF collection during onboarding.
 *
 * WHAT: Accepts a website, social URL, or PDF upload for org enrichment.
 * WHERE: Onboarding wizard, between knowledge upload and confirm steps.
 * WHY: Seeds tenant identity for Communio, NRI, and public presence.
 */

import { useCallback, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Globe, HelpCircle, Upload, FileText, X, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import CommunioOptInCard from './CommunioOptInCard';
import { toast } from '@/components/ui/sonner';

interface Props {
  orgUrl: string;
  onOrgUrlChange: (url: string) => void;
  onCommunioOptIn: (optIn: boolean) => void;
  communioOptIn: boolean;
  orgPdf: File | null;
  onOrgPdfChange: (file: File | null) => void;
  discoveryOptIn?: boolean;
  onDiscoveryOptInChange?: (optIn: boolean) => void;
}

export default function OnboardingOrgEnrichmentStep({
  orgUrl, onOrgUrlChange, onCommunioOptIn, communioOptIn,
  orgPdf, onOrgPdfChange,
  discoveryOptIn = true, onDiscoveryOptInChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Maximum file size is 5 MB.');
      return;
    }

    onOrgPdfChange(file);
    // Clear URL when PDF is chosen
    if (orgUrl.trim()) onOrgUrlChange('');
  }, [onOrgPdfChange, onOrgUrlChange, orgUrl]);

  const clearPdf = useCallback(() => {
    onOrgPdfChange(null);
  }, [onOrgPdfChange]);

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <Globe className="h-7 w-7 text-primary" />
        </div>
        <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
          Help us tune discovery for your mission
        </CardTitle>
        <CardDescription className="max-w-md mx-auto">
          Share a website or public profile. We'll use publicly available information to
          personalize events, grants, and people discovery — and learn about your organization's mission.
        </CardDescription>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 mx-auto mt-1" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] text-xs space-y-1">
            <p><strong>What:</strong> We read your public page or PDF to learn your mission, programs, and location.</p>
            <p><strong>Where:</strong> This information seeds your CROS workspace identity.</p>
            <p><strong>Why:</strong> So NRI can speak your language from day one.</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* URL input — hidden when PDF is selected */}
        {!orgPdf && (
          <div className="space-y-3">
            <Input
              value={orgUrl}
              onChange={(e) => onOrgUrlChange(e.target.value)}
              placeholder="https://yourchurch.org or https://facebook.com/yourministry"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground/70">
              Accepts websites, Facebook pages, LinkedIn profiles, Instagram bios, or X/Twitter profiles.
            </p>
          </div>
        )}

        {/* Divider */}
        {!orgPdf && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* PDF upload */}
        {orgPdf ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{orgPdf.name}</p>
              <p className="text-xs text-muted-foreground">
                {(orgPdf.size / 1024).toFixed(0)} KB — ready for enrichment
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={clearPdf}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Button variant="outline" size="sm" className="w-full justify-start text-sm pointer-events-none">
              <Upload className="h-4 w-4 mr-2 shrink-0" />
              Upload a PDF about your organization
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ fontSize: '0' }}
            />
          </div>
        )}

        {/* Discovery personalization opt-in */}
        {(orgUrl.trim() || orgPdf) && onDiscoveryOptInChange && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <Checkbox
              id="discovery-opt-in"
              checked={discoveryOptIn}
              onCheckedChange={(checked) => onDiscoveryOptInChange(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="discovery-opt-in" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-primary" />
                Use this link to personalize discovery feeds
              </Label>
              <p className="text-xs text-muted-foreground/70">
                We only use public information from this link to help you find relevant events, grants, and partners.
              </p>
            </div>
          </div>
        )}

        {/* Communio opt-in — always visible */}
        <CommunioOptInCard
          optIn={communioOptIn}
          onOptInChange={onCommunioOptIn}
        />

        <p className="text-xs text-muted-foreground/70 text-center">
          This step is optional — you can always add your organization details later from Settings.
        </p>
      </CardContent>
    </Card>
  );
}
