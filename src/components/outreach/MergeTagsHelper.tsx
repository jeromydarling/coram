import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Copy, Check, Tags } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface MergeTag {
  tag: string;
  description: string;
  example: string;
}

const MERGE_TAGS: MergeTag[] = [
  {
    tag: '{{ contact.FIRSTNAME }}',
    description: 'First name',
    example: 'John',
  },
  {
    tag: '{{ contact.LASTNAME }}',
    description: 'Last name',
    example: 'Smith',
  },
  {
    tag: '{{ contact.FULLNAME }}',
    description: 'Full name',
    example: 'John Smith',
  },
  {
    tag: '{{ contact.EMAIL }}',
    description: 'Email address',
    example: 'john@example.com',
  },
  {
    tag: '{{ contact.ORGANIZATION }}',
    description: 'Organization name',
    example: 'Habitat for Humanity',
  },
  {
    tag: '{{ unsubscribe }}',
    description: 'Unsubscribe link (required)',
    example: '(auto-generated link)',
  },
];

export function MergeTagsHelper() {
  const [isOpen, setIsOpen] = useState(true);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const handleCopy = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedTag(tag);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedTag(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tags className="h-4 w-4" />
                Personalization Tags
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              Copy and paste these tags into your email. They'll be replaced with each recipient's data when sent.
            </p>
            <div className="space-y-2">
              {MERGE_TAGS.map((item) => (
                <div
                  key={item.tag}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono text-primary">{item.tag}</code>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description} — e.g., "{item.example}"
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 ml-2"
                    onClick={() => handleCopy(item.tag)}
                  >
                    {copiedTag === item.tag ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
