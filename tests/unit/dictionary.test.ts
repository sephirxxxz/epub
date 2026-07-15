import { describe, expect, it } from 'vitest';
import { DictionaryService, normalizeWord } from '../../src/features/dictionary/DictionaryService';

describe('DictionaryService', () => {
  const service = new DictionaryService();

  it('normalizes punctuation and unicode', () => {
    expect(normalizeWord(' “Ambiguous” ')).toBe('ambiguous');
  });

  it('looks up exact words', () => {
    expect(service.lookup('subtle')?.briefZh).toBe('微妙的');
  });

  it('resolves common inflections to dictionary lemmas', () => {
    expect(service.lookup('exhausted')?.lemma).toBe('exhaust');
    expect(service.lookup('looked')?.lemma).toBe('look');
  });

  it('does not invent unknown translations', () => {
    expect(service.lookup('not-in-the-dictionary')).toBeUndefined();
  });
});
