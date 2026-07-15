import { describe, expect, it } from 'vitest';
import { localDb } from '../../src/db/localDb';

describe('local persistence contracts', () => {
  it('uses a unique book/cfi pair for annotations', () => {
    const original = localDb.upsertAnnotation({
      id: 'a-1', bookId: 'book-x', href: 'chapter.xhtml', cfi: 'epubcfi(/6/4!/4/2)',
      surface: 'subtle', lemma: 'subtle', translation: '微妙的',
      detailSnapshot: { word: 'subtle', lemma: 'subtle', briefZh: '微妙的', definitions: ['微妙的'] },
      quote: 'subtle', prefix: 'The ', suffix: ' answer', hidden: false, status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const updated = localDb.upsertAnnotation({ ...original, id: 'a-2', translation: '不明显的' });
    expect(localDb.listAnnotations('book-x')).toHaveLength(1);
    expect(updated.translation).toBe('不明显的');
  });
});
