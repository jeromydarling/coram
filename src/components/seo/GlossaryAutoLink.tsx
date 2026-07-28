/**
 * GlossaryAutoLink — Wraps text content and auto-links first occurrence of glossary terms.
 *
 * WHAT: Scans children text and wraps first occurrence of each glossary term in a styled link.
 * WHERE: Used in marketing page body text to create semantic connections.
 * WHY: Builds internal link authority and helps users discover platform concepts.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { glossary } from '@/content/glossary';

interface GlossaryAutoLinkProps {
  children: string;
  /** Class to apply to the wrapper */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a paragraph with first occurrences of glossary terms linked.
 * Only links terms that have a route defined.
 */
export default function GlossaryAutoLink({ children, className, style }: GlossaryAutoLinkProps) {
  const linkedTerms = new Set<string>();
  const linkableTerms = glossary.filter((g) => g.route);

  // Sort by term length descending to match longer terms first
  const sorted = [...linkableTerms].sort((a, b) => b.term.length - a.term.length);

  // Build a regex that matches any glossary term (word boundary)
  const pattern = sorted.map((g) => `\\b${escapeRegex(g.term)}\\b`).join('|');
  if (!pattern) {
    return <p className={className} style={style}>{children}</p>;
  }

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = children.split(regex);

  const rendered = parts.map((part, i) => {
    // Check if this part matches a glossary term
    const match = sorted.find(
      (g) => g.term.toLowerCase() === part.toLowerCase(),
    );

    if (match && match.route && !linkedTerms.has(match.slug)) {
      linkedTerms.add(match.slug);
      return (
        <Link
          key={i}
          to={match.route}
          className="text-[hsl(var(--marketing-blue))] hover:underline font-medium"
          title={match.definition}
        >
          {part}
        </Link>
      );
    }

    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

  return <p className={className} style={style}>{rendered}</p>;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
