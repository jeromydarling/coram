/**
 * OnboardingFamiliaStep — Optional Familia discernment during onboarding.
 *
 * WHAT: Calm, optional panel asking if the tenant is part of a larger household.
 * WHERE: Onboarding wizard — after org enrichment, before confirm.
 * WHY: Introduces kinship without pressure. Default is "I'm not sure yet."
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Home, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type FamiliaChoice = 'create' | 'join' | 'skip';

interface Props {
  choice: FamiliaChoice;
  onChoiceChange: (c: FamiliaChoice) => void;
}

const OPTIONS: { key: FamiliaChoice; label: string; description: string; icon: typeof Users }[] = [
  {
    key: 'create',
    label: 'Start a new Familia',
    description: 'You are the first location or lead organization in a network.',
    icon: Home,
  },
  {
    key: 'join',
    label: 'Join an existing Familia',
    description: 'Another location or headquarters has already started one.',
    icon: Users,
  },
  {
    key: 'skip',
    label: "I'm not sure yet",
    description: 'You can always set this up later in Settings.',
    icon: HelpCircle,
  },
];

export default function OnboardingFamiliaStep({ choice, onChoiceChange }: Props) {
  return (
    <Card data-testid="onboarding-step-familia">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Are you part of a larger household?</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> Familia™ connects related organizations — parishes, chapters, campuses.</p>
              <p><strong>Where:</strong> This step is optional and can be revisited in Settings.</p>
              <p><strong>Why:</strong> Stay connected without losing your autonomy.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          Some organizations belong to a wider family — parishes in a diocese, chapters in a society,
          campuses in a network. If that's you, CROS can help you stay connected without losing autonomy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = choice === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChoiceChange(opt.key)}
                className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
