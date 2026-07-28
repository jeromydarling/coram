/**
 * PersonalityStrengthsPanel — Indoles Module
 *
 * WHAT: Reusable collapsible panel for viewing/editing personality & bio data.
 * WHERE: Person Detail, Volunteer Detail, Profile Settings pages.
 * WHY: Centralizes Indoles data display/editing across all entity types.
 *
 * Liturgical state: RESTING (calm, optional, no pressure to complete)
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, X, Sparkles, Plus } from "lucide-react";
import { TYPE_NAMES } from "@/components/indoles/EnneagramAssessment";
import { HelpTooltip } from "@/components/ui/help-tooltip";

// ── Types ──

export interface IndolesData {
  date_of_birth?: string | null;
  enneagram_type?: number | null;
  enneagram_wing?: number | null;
  enneagram_confidence?: number | null;
  enneagram_scores?: Record<number, number> | null;
  enneagram_source?: string | null;
  clifton_strengths?: string[] | null;
  disc_profile?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  languages?: string[] | null;
  interests?: string[] | null;
  comfort_areas?: string[] | null;
  availability_notes?: string | null;
  personality_visibility?: string | null;
}

export interface PersonalityStrengthsPanelProps {
  entityType: "profile" | "contact" | "volunteer";
  entityId: string;
  data?: IndolesData;
  readOnly?: boolean;
  showBio?: boolean;
  showVisibility?: boolean;
  showComfortAreas?: boolean;
  showAvailability?: boolean;
  onDataChange?: (updated: Partial<IndolesData>) => void;
}

// ── DISC Options ──
const DISC_OPTIONS = [
  "D — Dominance",
  "I — Influence",
  "S — Steadiness",
  "C — Conscientiousness",
  "DI", "DC", "ID", "IS", "SI", "SC", "CS", "CD",
];

// ── Tag Input Component ──
function TagInput({
  tags,
  onChange,
  placeholder,
  maxTags = 10,
  disabled,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  maxTags?: number;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val) && tags.length < maxTags) {
      onChange([...tags, val]);
      setInput("");
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 bg-ignatian-cream text-ignatian-brown border border-ignatian-border"
          >
            {tag}
            {!disabled && (
              <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && tags.length < maxTags && (
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder={placeholder}
            className="flex-1 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!input.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Self-fetch hook ──



function useIndolesData(entityType: string, entityId: string, externalData?: IndolesData) {
  const table = entityType === 'contact' ? 'contacts' : entityType === 'volunteer' ? 'volunteers' : 'profiles';
  const idCol = entityType === 'profile' ? 'user_id' : 'id';

  const { data, isLoading } = useQuery({
    queryKey: ['indoles-data', entityType, entityId],
    enabled: !externalData && !!entityId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: row } = await (supabase
        .from(table as any)
        .select('date_of_birth, enneagram_type, enneagram_wing, enneagram_confidence, enneagram_scores, enneagram_source, clifton_strengths, disc_profile, bio, skills, languages, interests, comfort_areas, availability_notes, personality_visibility')
        .eq(idCol, entityId)
        .maybeSingle() as any);
      return (row as IndolesData | null) || {};
    },
  });

  return { data: externalData || data || {}, isLoading: !externalData && isLoading };
}

// ── Main Component ──

export function PersonalityStrengthsPanel({
  entityType,
  entityId,
  data: externalData,
  readOnly = false,
  showBio = true,
  showVisibility = false,
  showComfortAreas = false,
  showAvailability = false,
  onDataChange,
}: PersonalityStrengthsPanelProps) {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data, isLoading: fetchingData } = useIndolesData(entityType, entityId, externalData);
  const [localData, setLocalData] = useState<IndolesData>({ ...data });

  // Sync localData when fetched data arrives
  useEffect(() => {
    if (data) setLocalData({ ...data });
  }, [data]);

  const updateField = useCallback(
    <K extends keyof IndolesData>(key: K, value: IndolesData[K]) => {
      setLocalData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const getAdjacentWings = (type: number | null | undefined): number[] => {
    if (!type) return [];
    const left = type === 1 ? 9 : type - 1;
    const right = type === 9 ? 1 : type + 1;
    return [left, right];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const table = entityType === "contact" ? "contacts" : entityType === "volunteer" ? "volunteers" : "profiles";
      const idCol = entityType === "profile" ? "user_id" : "id";

      const updatePayload: Record<string, unknown> = {};

      // Date of birth
      if (localData.date_of_birth !== data.date_of_birth) {
        updatePayload.date_of_birth = localData.date_of_birth || null;
      }

      // Enneagram
      if (localData.enneagram_type !== data.enneagram_type) updatePayload.enneagram_type = localData.enneagram_type || null;
      if (localData.enneagram_wing !== data.enneagram_wing) updatePayload.enneagram_wing = localData.enneagram_wing || null;
      if (localData.enneagram_type && !localData.enneagram_source) updatePayload.enneagram_source = "manual";

      // Frameworks
      if (JSON.stringify(localData.clifton_strengths) !== JSON.stringify(data.clifton_strengths)) {
        updatePayload.clifton_strengths = localData.clifton_strengths || [];
      }
      if (localData.disc_profile !== data.disc_profile) updatePayload.disc_profile = localData.disc_profile || null;

      // Bio/enrichment
      if (localData.bio !== data.bio) updatePayload.bio = localData.bio || null;
      if (JSON.stringify(localData.skills) !== JSON.stringify(data.skills)) updatePayload.skills = localData.skills || [];
      if (JSON.stringify(localData.languages) !== JSON.stringify(data.languages)) updatePayload.languages = localData.languages || [];
      if (JSON.stringify(localData.interests) !== JSON.stringify(data.interests)) updatePayload.interests = localData.interests || [];

      // Volunteer-specific
      if (showComfortAreas && JSON.stringify(localData.comfort_areas) !== JSON.stringify(data.comfort_areas)) {
        updatePayload.comfort_areas = localData.comfort_areas || [];
      }
      if (showAvailability && localData.availability_notes !== data.availability_notes) {
        updatePayload.availability_notes = localData.availability_notes || null;
      }

      // Visibility
      if (showVisibility && localData.personality_visibility !== data.personality_visibility) {
        updatePayload.personality_visibility = localData.personality_visibility || "private";
      }

      if (Object.keys(updatePayload).length === 0) {
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from(table as any)
        .update(updatePayload as any)
        .eq(idCol, entityId);

      if (error) throw error;

      toast({ title: "Personality & strengths updated" });
      onDataChange?.(updatePayload as Partial<IndolesData>);
    } catch (err) {
      console.error("[indoles] save error:", err);
      toast({ title: "Could not save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const parsedDob = localData.date_of_birth ? new Date(localData.date_of_birth + "T00:00:00") : undefined;
  const wings = getAdjacentWings(localData.enneagram_type);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 bg-ignatian-cream/50 hover:bg-ignatian-cream rounded-lg border border-ignatian-border transition-colors group">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ignatian-gold" />
          <span className="text-sm font-medium text-ignatian-brown font-serif-body">
            Personality & Strengths
          </span>
          <HelpTooltip
            what="View and edit personality data — Enneagram, CliftonStrengths, DISC, bio, and more."
            where="Indoles module — personality intelligence layer."
            why="Helps NRI make more nuanced relational pairing suggestions."
          />
          {localData.enneagram_type && (
            <Badge variant="secondary" className="bg-ignatian-cream text-ignatian-gold border border-ignatian-border text-xs">
              Type {localData.enneagram_type}{localData.enneagram_wing ? `w${localData.enneagram_wing}` : ""}
            </Badge>
          )}
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-ignatian-muted transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-6 px-1">
        <p className="text-xs text-ignatian-muted font-serif-body italic">
          This is completely optional and helps your community understand natural strengths and relational style.
        </p>

        {/* Birthday */}
        <div className="space-y-2">
          <Label className="text-sm font-serif-body text-ignatian-brown">Birthday</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={readOnly}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !parsedDob && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {parsedDob ? format(parsedDob, "MMMM d, yyyy") : "Select birthday"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parsedDob}
                onSelect={(date) => {
                  updateField("date_of_birth", date ? format(date, "yyyy-MM-dd") : null);
                }}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Enneagram */}
        <div className="space-y-3">
          <Label className="text-sm font-serif-body text-ignatian-brown">Enneagram Type</Label>
          <Select
            value={localData.enneagram_type?.toString() || ""}
            onValueChange={(v) => {
              const type = parseInt(v);
              updateField("enneagram_type", type);
              // Clear wing if no longer adjacent
              if (localData.enneagram_wing) {
                const adj = getAdjacentWings(type);
                if (!adj.includes(localData.enneagram_wing)) {
                  updateField("enneagram_wing", null);
                }
              }
            }}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type (optional)" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) => (
                <SelectItem key={t} value={t.toString()}>
                  Type {t} — {TYPE_NAMES[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {localData.enneagram_type && wings.length > 0 && (
            <div>
              <Label className="text-xs font-serif-body text-ignatian-muted">Wing</Label>
              <Select
                value={localData.enneagram_wing?.toString() || ""}
                onValueChange={(v) => updateField("enneagram_wing", parseInt(v))}
                disabled={readOnly}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select wing (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {wings.map((w) => (
                    <SelectItem key={w} value={w.toString()}>
                      Wing {w} — {TYPE_NAMES[w]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {localData.enneagram_source === "assessment" && localData.enneagram_confidence && (
            <p className="text-xs text-ignatian-muted font-serif-body">
              Assessed · Confidence: {localData.enneagram_confidence}%
            </p>
          )}

          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="text-ignatian-gold border-ignatian-border hover:bg-ignatian-cream font-serif-body"
              onClick={() => {
                if (tenant?.slug) {
                  const params = new URLSearchParams({
                    entity: entityType,
                    id: entityId,
                  });
                  navigate(`/${tenant.slug}/assessment/enneagram?${params}`);
                }
              }}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {localData.enneagram_type ? "Retake Assessment" : "Take the Enneagram Assessment"}
            </Button>
          )}
        </div>

        {/* CliftonStrengths */}
        <div className="space-y-2">
          <Label className="text-sm font-serif-body text-ignatian-brown">
            CliftonStrengths (Top 5)
          </Label>
          <p className="text-xs text-ignatian-muted font-serif-body">
            If you've taken CliftonStrengths elsewhere, add your results here.
          </p>
          <TagInput
            tags={(localData.clifton_strengths as string[]) || []}
            onChange={(tags) => updateField("clifton_strengths", tags)}
            placeholder="e.g. Strategic, Empathy..."
            maxTags={5}
            disabled={readOnly}
          />
        </div>

        {/* DISC */}
        <div className="space-y-2">
          <Label className="text-sm font-serif-body text-ignatian-brown">DISC Profile</Label>
          <p className="text-xs text-ignatian-muted font-serif-body">
            If you've taken DISC elsewhere, add your results here.
          </p>
          <Select
            value={localData.disc_profile || ""}
            onValueChange={(v) => updateField("disc_profile", v || null)}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select DISC profile (optional)" />
            </SelectTrigger>
            <SelectContent>
              {DISC_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bio */}
        {showBio && (
          <div className="space-y-2">
            <Label className="text-sm font-serif-body text-ignatian-brown">Bio</Label>
            <Textarea
              value={localData.bio || ""}
              onChange={(e) => updateField("bio", e.target.value.slice(0, 500))}
              placeholder="A short introduction..."
              maxLength={500}
              rows={3}
              disabled={readOnly}
              className="resize-none"
            />
            <p className="text-xs text-ignatian-muted text-right">
              {(localData.bio || "").length}/500
            </p>
          </div>
        )}

        {/* Skills */}
        {showBio && (
          <div className="space-y-2">
            <Label className="text-sm font-serif-body text-ignatian-brown">Skills</Label>
            <TagInput
              tags={(localData.skills as string[]) || []}
              onChange={(tags) => updateField("skills", tags)}
              placeholder="e.g. Teaching, Counseling..."
              disabled={readOnly}
            />
          </div>
        )}

        {/* Languages */}
        {showBio && (
          <div className="space-y-2">
            <Label className="text-sm font-serif-body text-ignatian-brown">Languages</Label>
            <TagInput
              tags={(localData.languages as string[]) || []}
              onChange={(tags) => updateField("languages", tags)}
              placeholder="e.g. English, Spanish..."
              disabled={readOnly}
            />
          </div>
        )}

        {/* Interests (contacts + profiles only) */}
        {showBio && !showComfortAreas && (
          <div className="space-y-2">
            <Label className="text-sm font-serif-body text-ignatian-brown">Interests</Label>
            <TagInput
              tags={(localData.interests as string[]) || []}
              onChange={(tags) => updateField("interests", tags)}
              placeholder="e.g. Faith formation, Community garden..."
              disabled={readOnly}
            />
          </div>
        )}

        {/* Comfort Areas (volunteers only) */}
        {showComfortAreas && (
          <div className="space-y-2">
            <Label className="text-sm font-serif-body text-ignatian-brown">Comfort Areas</Label>
            <p className="text-xs text-ignatian-muted font-serif-body">
              Populations or contexts this person is comfortable serving in.
            </p>
            <TagInput
              tags={(localData.comfort_areas as string[]) || []}
              onChange={(tags) => updateField("comfort_areas", tags)}
              placeholder="e.g. Seniors, Youth, Bilingual Spanish..."
              disabled={readOnly}
            />
          </div>
        )}

        {/* Availability Notes (volunteers only) */}
        {showAvailability && (
          <div className="space-y-2">
            <Label className="text-sm font-serif-body text-ignatian-brown">Availability Notes</Label>
            <Textarea
              value={localData.availability_notes || ""}
              onChange={(e) => updateField("availability_notes", e.target.value)}
              placeholder="General availability patterns..."
              rows={2}
              disabled={readOnly}
              className="resize-none"
            />
          </div>
        )}

        {/* Visibility Toggle (profiles only) */}
        {showVisibility && (
          <div className="space-y-2">
            <Label className="text-sm font-serif-body text-ignatian-brown">
              Personality Visibility
            </Label>
            <Select
              value={localData.personality_visibility || "private"}
              onValueChange={(v) => updateField("personality_visibility", v)}
              disabled={readOnly}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private — only you and admins can see</SelectItem>
                <SelectItem value="community">Community — other members can see your type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Save Button */}
        {!readOnly && (
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-ignatian-gold to-ignatian-gold-light text-white hover:opacity-90 font-serif-body"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
