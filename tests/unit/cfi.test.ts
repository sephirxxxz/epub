import { describe, expect, it } from 'vitest';
import { contextAround } from '../../src/features/reader/cfi/cfi';

describe('CFI helpers', () => {
  it('extracts quote context from a range', () => {
    const document = new DOMParser().parseFromString('The subtle answer was useful.', 'text/html');
    const text = document.body.firstChild!;
    const range = document.createRange();
    range.setStart(text, 4);
    range.setEnd(text, 10);
    expect(contextAround(range)).toEqual({ quote: 'subtle', prefix: 'The ', suffix: ' answer was useful.' });
  });
});
