/**
 * CROS™ Enneagram Assessment — Indoles Module
 *
 * WHAT: 36-question Likert-scale assessment deriving Enneagram type, wing, and confidence.
 * WHERE: Standalone route at /:tenantSlug/assessment/enneagram
 * WHY: Highest-confidence personality data for NRI matching (Tier 3).
 *
 * Liturgical state: DISCERNING (reflective, no urgency)
 */

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft } from "lucide-react";

// ── Type Data ──

export const TYPE_NAMES: Record<number, string> = {
  1: "The Reformer",
  2: "The Helper",
  3: "The Achiever",
  4: "The Individualist",
  5: "The Investigator",
  6: "The Loyalist",
  7: "The Enthusiast",
  8: "The Challenger",
  9: "The Peacemaker",
};

const TYPE_DESCRIPTIONS: Record<number, string> = {
  1: "Principled, purposeful, and self-controlled. You have a strong sense of right and wrong and a desire to improve the world around you.",
  2: "Generous, warm-hearted, and people-pleasing. You are driven by a desire to be loved and needed, often putting others' needs before your own.",
  3: "Adaptable, driven, and image-conscious. You are motivated by a need to succeed, to be admired, and to distinguish yourself through achievements.",
  4: "Expressive, dramatic, and self-aware. You long for authenticity and significance, often feeling that something essential is missing from your experience.",
  5: "Perceptive, cerebral, and independent. You seek understanding and knowledge, preferring to observe the world before engaging with it.",
  6: "Committed, security-oriented, and vigilant. You are loyal and responsible, often anticipating problems and preparing for worst-case scenarios.",
  7: "Spontaneous, versatile, and scattered. You pursue new experiences and possibilities, seeking to maintain freedom and avoid pain or boredom.",
  8: "Powerful, decisive, and confrontational. You value strength and control, and are driven to protect yourself and those in your care.",
  9: "Receptive, reassuring, and agreeable. You seek inner and outer peace, often merging with others' agendas to avoid conflict.",
};

const TYPE_STRENGTHS: Record<number, string[]> = {
  1: ["Integrity", "Discipline", "Moral clarity", "Attention to detail"],
  2: ["Empathy", "Generosity", "Relational warmth", "Attentiveness"],
  3: ["Drive", "Adaptability", "Confidence", "Goal orientation"],
  4: ["Emotional depth", "Creativity", "Authenticity", "Compassion for suffering"],
  5: ["Analytical thinking", "Objectivity", "Independence", "Deep expertise"],
  6: ["Loyalty", "Courage under pressure", "Preparedness", "Community-mindedness"],
  7: ["Optimism", "Versatility", "Quick thinking", "Infectious energy"],
  8: ["Leadership", "Decisiveness", "Protectiveness", "Directness"],
  9: ["Mediation", "Patience", "Acceptance", "Seeing all perspectives"],
};

const TYPE_GROWTH: Record<number, string> = {
  1: "Toward spontaneity and self-acceptance (integrates to 7)",
  2: "Toward self-care and healthy boundaries (integrates to 4)",
  3: "Toward authenticity and cooperation (integrates to 6)",
  4: "Toward discipline and principled action (integrates to 1)",
  5: "Toward confidence and decisive engagement (integrates to 8)",
  6: "Toward inner calm and relaxed trust (integrates to 9)",
  7: "Toward depth and focused commitment (integrates to 5)",
  8: "Toward vulnerability and open-heartedness (integrates to 2)",
  9: "Toward self-assertion and purposeful action (integrates to 3)",
};

// ── Questions ──

interface Question {
  id: number;
  type: number;
  text: string;
}

const QUESTIONS: Question[] = [
  { id: 1, type: 1, text: "When I see something done incorrectly, I feel a strong internal pull to fix it." },
  { id: 2, type: 1, text: "I hold myself to standards that others sometimes find unnecessarily high." },
  { id: 3, type: 1, text: "I often have a critical inner voice evaluating whether I've done the right thing." },
  { id: 4, type: 1, text: "I believe that with enough effort, most things can be improved or perfected." },
  { id: 5, type: 2, text: "I instinctively notice when someone around me is struggling, even before they say anything." },
  { id: 6, type: 2, text: "I find it much easier to express what others need than to articulate my own needs." },
  { id: 7, type: 2, text: "Being appreciated for my help is one of the most fulfilling feelings I experience." },
  { id: 8, type: 2, text: "I sometimes overextend myself for others and only realize it after I'm exhausted." },
  { id: 9, type: 3, text: "I naturally adjust how I present myself depending on the group I'm with." },
  { id: 10, type: 3, text: "Accomplishing goals gives me a deep sense of identity and worth." },
  { id: 11, type: 3, text: "When I'm not being productive, I feel restless or like I'm wasting time." },
  { id: 12, type: 3, text: "I'm often aware of how others perceive my success or competence." },
  { id: 13, type: 4, text: "I often feel like I experience emotions more deeply than the people around me." },
  { id: 14, type: 4, text: "There's a persistent sense that something important is missing from my life." },
  { id: 15, type: 4, text: "I'm drawn to beauty, meaning, and experiences that feel authentic rather than ordinary." },
  { id: 16, type: 4, text: "I sometimes withdraw from others to process intense feelings on my own." },
  { id: 17, type: 5, text: "I need significant time alone to recharge and feel like myself." },
  { id: 18, type: 5, text: "I prefer to thoroughly understand something before I share my opinion about it." },
  { id: 19, type: 5, text: "I tend to observe a situation carefully before deciding whether to participate." },
  { id: 20, type: 5, text: "I'm uncomfortable when people make emotional demands on my time or energy." },
  { id: 21, type: 6, text: "My mind often jumps to what could go wrong in a situation before I consider what could go right." },
  { id: 22, type: 6, text: "Loyalty and trustworthiness are among the most important qualities I look for in people." },
  { id: 23, type: 6, text: "I frequently seek reassurance or second opinions before making important decisions." },
  { id: 24, type: 6, text: "I'm naturally skeptical of authority until I've decided someone has earned my trust." },
  { id: 25, type: 7, text: "I get excited about new plans and possibilities, sometimes before finishing current ones." },
  { id: 26, type: 7, text: "I instinctively reframe negative experiences into positive lessons or silver linings." },
  { id: 27, type: 7, text: "Being constrained or limited in my options feels deeply uncomfortable to me." },
  { id: 28, type: 7, text: "I'd rather have many good experiences than dive deeply into just one." },
  { id: 29, type: 8, text: "I'd rather have a hard truth than a comfortable lie, and I expect the same from others." },
  { id: 30, type: 8, text: "When I walk into a room, I quickly assess who holds the power and how it's being used." },
  { id: 31, type: 8, text: "I feel a strong drive to protect people who can't protect themselves." },
  { id: 32, type: 8, text: "I tend to take charge in situations where no one else is stepping up." },
  { id: 33, type: 9, text: "I often go along with what others want because it's easier than asserting my own preference." },
  { id: 34, type: 9, text: "I can see the validity in almost every perspective, which sometimes makes it hard to take sides." },
  { id: 35, type: 9, text: "I tend to minimize my own problems so as not to burden others or create conflict." },
  { id: 36, type: 9, text: "Inner peace and harmony in my relationships matter more to me than being right." },
];

const LIKERT_OPTIONS = [
  { value: 1, label: "Not at all like me" },
  { value: 2, label: "Slightly like me" },
  { value: 3, label: "Somewhat like me" },
  { value: 4, label: "Very much like me" },
  { value: 5, label: "Exactly like me" },
];

// ── Helpers ──

function shuffleArray<T>(arr: T[], seed = 42): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface EnneagramResult {
  enneagram_type: number;
  enneagram_wing: number;
  enneagram_confidence: number;
  enneagram_scores: Record<number, number>;
  enneagram_source: 'assessment';
}

function calculateResults(answers: Record<number, number>): EnneagramResult & {
  primaryScore: number;
  sortedTypes: [string, number][];
} {
  const typeScores: Record<number, number> = {};
  for (let t = 1; t <= 9; t++) typeScores[t] = 0;

  Object.entries(answers).forEach(([qId, value]) => {
    const question = QUESTIONS.find((q) => q.id === parseInt(qId));
    if (question) typeScores[question.type] += value;
  });

  const maxPerType = 20;
  const normalized: Record<number, number> = {};
  for (let t = 1; t <= 9; t++) {
    normalized[t] = Math.round((typeScores[t] / maxPerType) * 100);
  }

  const sortedTypes = Object.entries(normalized).sort(
    (a, b) => b[1] - a[1]
  ) as [string, number][];
  const primaryType = parseInt(sortedTypes[0][0]);
  const primaryScore = sortedTypes[0][1];

  const leftWing = primaryType === 1 ? 9 : primaryType - 1;
  const rightWing = primaryType === 9 ? 1 : primaryType + 1;
  const wing = normalized[leftWing] >= normalized[rightWing] ? leftWing : rightWing;

  const confidence = Math.min(
    100,
    Math.max(30, Math.round(((sortedTypes[0][1] - sortedTypes[1][1]) / 100) * 100 + 50))
  );

  return {
    enneagram_type: primaryType,
    enneagram_wing: wing,
    enneagram_confidence: confidence,
    enneagram_scores: normalized,
    enneagram_source: 'assessment',
    primaryScore,
    sortedTypes,
  };
}

// ── Sub-Components ──

function LikertScale({
  value,
  onChange,
  questionId,
}: {
  value: number | undefined;
  onChange: (qId: number, val: number) => void;
  questionId: number;
}) {
  return (
    <div className="flex flex-col gap-2 mt-6">
      {LIKERT_OPTIONS.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(questionId, opt.value)}
            className={cn(
              "flex items-center gap-3.5 px-4 py-3.5 rounded-xl border-2 text-left font-serif-body text-[15px] transition-all duration-200",
              isSelected
                ? "border-ignatian-gold bg-gradient-to-br from-ignatian-cream to-ignatian-cream-dark text-ignatian-brown"
                : "border-ignatian-border bg-ignatian-bg text-ignatian-muted hover:border-ignatian-tan"
            )}
          >
            <div
              className={cn(
                "w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                isSelected ? "border-ignatian-gold" : "border-ignatian-tan"
              )}
            >
              {isSelected && (
                <div className="w-3 h-3 rounded-full bg-ignatian-gold" />
              )}
            </div>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ScoreBar({ type, score, isHighest }: { type: number; score: number; isHighest: boolean }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1 font-serif-body text-[13px]">
        <span className={cn(isHighest ? "text-ignatian-brown font-semibold" : "text-ignatian-muted")}>
          {type} — {TYPE_NAMES[type]}
        </span>
        <span className="text-ignatian-muted">{score}%</span>
      </div>
      <div className="h-2 bg-ignatian-cream-dark rounded overflow-hidden">
        <div
          className={cn(
            "h-full rounded transition-all duration-1000 ease-out",
            isHighest
              ? "bg-gradient-to-r from-ignatian-gold to-ignatian-gold-light"
              : "bg-ignatian-tan"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function ResultsView({
  results,
  onRetake,
  onSave,
}: {
  results: EnneagramResult & { primaryScore: number; sortedTypes: [string, number][] };
  onRetake: () => void;
  onSave?: (r: EnneagramResult) => void;
}) {
  const { enneagram_type, enneagram_wing, enneagram_confidence, sortedTypes } = results;

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-700">
      {/* Primary Result */}
      <div className="text-center mb-10 px-6 py-9 bg-gradient-to-br from-ignatian-cream to-ignatian-cream-dark rounded-2xl border border-ignatian-border">
        <div className="text-xs tracking-[0.15em] uppercase text-ignatian-muted font-serif-body mb-2">
          Your Primary Type
        </div>
        <div className="text-5xl font-bold text-ignatian-brown font-serif leading-none">
          Type {enneagram_type}
        </div>
        <div className="text-xl text-ignatian-gold font-serif italic mt-1">
          {TYPE_NAMES[enneagram_type]}
        </div>
        <div className="text-[15px] text-ignatian-muted font-serif-body mt-1.5">
          Wing: {enneagram_wing} · Confidence: {enneagram_confidence}%
        </div>
      </div>

      {/* Description */}
      <div className="mb-8">
        <h3 className="text-xs tracking-[0.12em] uppercase text-ignatian-gold font-serif-body mb-3">
          About This Type
        </h3>
        <p className="text-[15px] leading-[1.7] text-ignatian-brown font-serif-body">
          {TYPE_DESCRIPTIONS[enneagram_type]}
        </p>
      </div>

      {/* Strengths */}
      <div className="mb-8">
        <h3 className="text-xs tracking-[0.12em] uppercase text-ignatian-gold font-serif-body mb-3">
          Core Strengths
        </h3>
        <div className="flex flex-wrap gap-2">
          {TYPE_STRENGTHS[enneagram_type].map((s) => (
            <span
              key={s}
              className="px-3.5 py-1.5 bg-ignatian-cream border border-ignatian-border rounded-full text-[13px] text-ignatian-brown font-serif-body"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Growth Direction */}
      <div className="mb-9">
        <h3 className="text-xs tracking-[0.12em] uppercase text-ignatian-gold font-serif-body mb-3">
          Growth Direction
        </h3>
        <p className="text-[15px] leading-[1.7] text-ignatian-brown font-serif-body italic">
          {TYPE_GROWTH[enneagram_type]}
        </p>
      </div>

      {/* All Scores */}
      <div className="mb-9">
        <h3 className="text-xs tracking-[0.12em] uppercase text-ignatian-gold font-serif-body mb-4">
          Full Profile
        </h3>
        {sortedTypes.map(([type, score]) => (
          <ScoreBar
            key={type}
            type={parseInt(type)}
            score={score}
            isHighest={parseInt(type) === enneagram_type}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center flex-wrap">
        {onSave && (
          <Button
            onClick={() => onSave(results)}
            className="bg-gradient-to-r from-ignatian-gold to-ignatian-gold-light text-white hover:opacity-90 font-serif-body"
          >
            Save Results
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onRetake}
          className="border-ignatian-gold text-ignatian-gold hover:bg-ignatian-cream font-serif-body"
        >
          Retake Assessment
        </Button>
      </div>

      {/* Data Note */}
      <div className="mt-8 p-4 bg-ignatian-bg rounded-lg border border-ignatian-cream-dark text-center">
        <p className="text-xs text-ignatian-muted font-serif-body">
          Your results: Type {enneagram_type}w{enneagram_wing} ({TYPE_NAMES[enneagram_type]}) · Confidence {enneagram_confidence}%
          <br />
          This data is saved to your CROS™ Indoles profile and informs NRI matching.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ──

export interface EnneagramAssessmentProps {
  onComplete?: (result: EnneagramResult) => void;
  onManualSelect?: () => void;
}

export default function EnneagramAssessment({ onComplete, onManualSelect }: EnneagramAssessmentProps) {
  const [phase, setPhase] = useState<"intro" | "assessment" | "results">("intro");
  const [questions] = useState(() =>
    shuffleArray(QUESTIONS, Math.floor(Math.random() * 10000))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [results, setResults] = useState<ReturnType<typeof calculateResults> | null>(null);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");
  const questionRef = useRef<HTMLDivElement>(null);

  const handleAnswer = (questionId: number, value: number) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setFadeState("out");
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
          setFadeState("in");
        }, 250);
      } else {
        const res = calculateResults(newAnswers);
        setResults(res);
        setPhase("results");
      }
    }, 350);
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setResults(null);
    setPhase("intro");
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setFadeState("out");
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setFadeState("in");
      }, 250);
    }
  };

  const handleSave = (result: EnneagramResult) => {
    onComplete?.(result);
  };

  const currentQuestion = questions[currentIndex];
  const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-ignatian-bg to-ignatian-bg-end flex justify-center px-4 py-10">
      <div className="max-w-[560px] w-full">
        {/* Header */}
        <div className="text-center mb-9">
          <div className="text-[11px] tracking-[0.25em] uppercase text-ignatian-gold font-serif-body mb-2">
            CROS™ Indoles
          </div>
          <h1 className="text-3xl font-bold text-ignatian-deep font-serif leading-tight">
            Enneagram Assessment
          </h1>
          <div className="w-10 h-0.5 bg-ignatian-gold mx-auto mt-3" />
        </div>

        {/* ── Intro Phase ── */}
        {phase === "intro" && (
          <div className="animate-in fade-in-0 duration-600">
            <div className="bg-card rounded-2xl p-7 sm:p-9 shadow-card border border-ignatian-cream-dark">
              <p className="text-base leading-[1.8] text-ignatian-brown font-serif-body mb-5">
                The Enneagram is an ancient personality framework that identifies nine core
                motivations shaping how we see and engage with the world. This assessment helps
                your community understand your natural strengths and relational style.
              </p>
              <p className="text-[15px] leading-[1.8] text-ignatian-muted font-serif-body mb-6">
                You'll answer 36 questions about how you naturally think, feel, and act. There
                are no right or wrong answers — respond with what feels most true, not what you
                wish were true.
              </p>
              <p className="text-sm leading-[1.8] text-ignatian-muted font-serif-body italic mb-8">
                Takes approximately 5–8 minutes.
              </p>
              <div className="text-center">
                <Button
                  onClick={() => setPhase("assessment")}
                  size="lg"
                  className="bg-gradient-to-br from-ignatian-gold to-ignatian-gold-light text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all font-serif-body tracking-wide"
                >
                  Begin Assessment
                </Button>
              </div>
            </div>

            {onManualSelect && (
              <div className="mt-6 text-center">
                <p className="text-[13px] text-ignatian-muted font-serif-body">
                  Already know your Enneagram type?{" "}
                  <button
                    onClick={onManualSelect}
                    className="text-ignatian-gold underline cursor-pointer hover:text-ignatian-gold-light transition-colors"
                  >
                    Select it manually instead
                  </button>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Assessment Phase ── */}
        {phase === "assessment" && currentQuestion && (
          <div>
            {/* Progress */}
            <div className="mb-8">
              <div className="flex justify-between mb-1.5 font-serif-body text-[13px] text-ignatian-muted tracking-wide">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>{progressPct}%</span>
              </div>
              <Progress
                value={progressPct}
                className="h-1 bg-ignatian-cream-dark [&>div]:bg-gradient-to-r [&>div]:from-ignatian-gold [&>div]:to-ignatian-gold-light"
              />
            </div>

            <div className="bg-card rounded-2xl p-7 sm:p-9 shadow-card border border-ignatian-cream-dark min-h-[360px]">
              <div
                ref={questionRef}
                className={cn(
                  "transition-all duration-300",
                  fadeState === "in"
                    ? "animate-in fade-in-0 slide-in-from-bottom-3"
                    : "animate-out fade-out-0 slide-out-to-top-3"
                )}
              >
                <p className="text-lg leading-[1.65] text-ignatian-deep font-serif">
                  "{currentQuestion.text}"
                </p>
                <LikertScale
                  value={answers[currentQuestion.id]}
                  onChange={handleAnswer}
                  questionId={currentQuestion.id}
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={handleBack}
                disabled={currentIndex === 0}
                className={cn(
                  "flex items-center gap-1 px-4 py-2 text-sm font-serif-body transition-colors",
                  currentIndex === 0
                    ? "text-ignatian-tan cursor-default"
                    : "text-ignatian-gold hover:text-ignatian-gold-light cursor-pointer"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <span className="text-[13px] text-ignatian-tan font-serif-body">
                {Object.keys(answers).length} of {questions.length} answered
              </span>
            </div>
          </div>
        )}

        {/* ── Results Phase ── */}
        {phase === "results" && results && (
          <div className="bg-card rounded-2xl p-7 sm:p-9 shadow-card border border-ignatian-cream-dark">
            <ResultsView
              results={results}
              onRetake={handleRetake}
              onSave={onComplete ? handleSave : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
