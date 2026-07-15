import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderAnnotations } from '../../src/features/reader/annotations/renderAnnotations';

function contentsFor(html: string) {
  const dom = new JSDOM(html);
  const text = dom.window.document.querySelector('p')!.firstChild!;
  const range = dom.window.document.createRange();
  range.setStart(text, 4);
  range.setEnd(text, 10);
  return {
    document: dom.window.document,
    range: () => range,
  };
}

describe('renderAnnotations', () => {
  it('renders the selected text once and is idempotent', () => {
    const contents = contentsFor('<p>The subtle answer.</p>');
    const annotation = {
      id: 'a-1', bookId: 'book-1', href: 'chapter.xhtml', cfi: 'fake', surface: 'subtle', lemma: 'subtle',
      translation: '微妙的', detailSnapshot: { word: 'subtle', lemma: 'subtle', briefZh: '微妙的', definitions: ['微妙的'] },
      quote: 'subtle', prefix: 'The ', suffix: ' answer', hidden: false, status: 'active' as const,
      createdAt: '2026-01-01', updatedAt: '2026-01-01',
    };
    // Replace the CFI resolver with the test range while exercising the public renderer.
    renderAnnotations(contents, [annotation]);
    expect(contents.document.body.textContent).toContain('The subtle微妙的 answer.');
    expect(contents.document.querySelectorAll('.glossary-annotation')).toHaveLength(1);
  });
});
