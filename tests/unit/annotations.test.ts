import { describe, expect, it } from 'vitest';
import { createAnnotation } from '../../src/features/reader/annotations/annotationStore';

const entry = {
  word: 'subtle', lemma: 'subtle', briefZh: '微妙的', definitions: ['微妙的'],
};

describe('annotation model', () => {
  it('keeps a location snapshot independent from the source EPUB', () => {
    const annotation = createAnnotation('book-1', {
      href: 'chapter.xhtml', cfi: 'epubcfi(/6/4!/4/2/2)', quote: 'subtle', prefix: 'The ', suffix: ' answer',
    }, entry);
    expect(annotation.bookId).toBe('book-1');
    expect(annotation.cfi).toContain('epubcfi');
    expect(annotation.translation).toBe('微妙的');
    expect(annotation.hidden).toBe(false);
  });
});
