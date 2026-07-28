/**
 * Shared HTML sanitization utility using DOMPurify.
 * 
 * WHAT: Provides consistent HTML sanitization across the application.
 * WHERE: Used by any component that renders HTML via dangerouslySetInnerHTML.
 * WHY: Prevents XSS attacks from unsanitized HTML content.
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content for safe rendering.
 * Allows common formatting tags but strips scripts, event handlers, and dangerous protocols.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u',
      'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li',
      'blockquote', 'a', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'hr', 'pre', 'code',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i,
  });
}

/**
 * Sanitize markdown-converted HTML with a more restrictive tag set.
 */
export function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'a', 'li', 'br', 'p', 'ul', 'ol', 'blockquote', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(?:https?:)/i,
  });
}
