import { describe, expect, it } from 'vitest';

import { assertUnsubscribable, renderMergeFields, unknownMergeFields } from './sender';

describe('renderMergeFields', () => {
  it('substitutes known fields', () => {
    expect(
      renderMergeFields('Hi {{display_name}}, meeting near {{postal_code}}.', {
        display_name: 'A. Okonkwo',
        postal_code: '60625',
      }),
    ).toBe('Hi A. Okonkwo, meeting near 60625.');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderMergeFields('Hi {{  display_name  }}', { display_name: 'Ada' })).toBe('Hi Ada');
  });

  it('takes the first word for first_name', () => {
    expect(renderMergeFields('{{first_name}}', { display_name: 'Ada B. Márquez' })).toBe('Ada');
  });

  it('falls back to the whole name when there is only one word', () => {
    expect(renderMergeFields('{{first_name}}', { display_name: 'Prince' })).toBe('Prince');
  });

  /*
   * The important one. "Hi {{frist_name}}," reaching four thousand people is a
   * bad day. "Hi ," reaching four thousand people is worse, because it looks
   * fine in the composer and nobody catches it before it sends.
   */
  it('leaves an unknown field visible rather than blanking it', () => {
    expect(renderMergeFields('Hi {{frist_name}},', { display_name: 'Ada' })).toBe(
      'Hi {{frist_name}},',
    );
  });

  it('renders a missing postal code as empty, not as undefined', () => {
    expect(renderMergeFields('[{{postal_code}}]', { display_name: 'Ada' })).toBe('[]');
    expect(renderMergeFields('[{{postal_code}}]', { display_name: 'Ada', postal_code: null })).toBe(
      '[]',
    );
  });

  it('does not treat contact data as a template', () => {
    // A contact named with braces must not cause a second substitution pass.
    expect(renderMergeFields('{{display_name}}', { display_name: '{{postal_code}}' })).toBe(
      '{{postal_code}}',
    );
  });
});

describe('unknownMergeFields', () => {
  it('reports typos for the composer to warn on', () => {
    expect(unknownMergeFields('{{display_name}} {{frist_name}} {{email}}')).toEqual([
      'frist_name',
      'email',
    ]);
  });

  it('reports nothing when every field is known', () => {
    expect(unknownMergeFields('{{display_name}} {{postal_code}}')).toEqual([]);
  });

  it('deduplicates', () => {
    expect(unknownMergeFields('{{nope}} {{nope}}')).toEqual(['nope']);
  });
});

describe('assertUnsubscribable', () => {
  // §5.4 admits no exceptions, and "this one is transactional" is exactly how
  // the first email without an unsubscribe link gets sent.
  it('refuses an email with no unsubscribe link', () => {
    expect(() =>
      assertUnsubscribable({ to: 'a@b.org', subject: 's', body: 'b', unsubscribeUrl: '' }),
    ).toThrow(/unsubscribe/);
  });

  it('accepts one that has it', () => {
    expect(() =>
      assertUnsubscribable({
        to: 'a@b.org',
        subject: 's',
        body: 'b',
        unsubscribeUrl: 'https://coram.app/u/abc',
      }),
    ).not.toThrow();
  });
});
