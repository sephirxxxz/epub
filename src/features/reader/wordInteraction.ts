export interface ClickWord {
  range: Range;
  word: string;
}

function pointRange(document: Document, event: MouseEvent): Range | null {
  const docWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
  };
  if (docWithCaret.caretRangeFromPoint) return docWithCaret.caretRangeFromPoint(event.clientX, event.clientY);
  const position = docWithCaret.caretPositionFromPoint?.(event.clientX, event.clientY);
  if (!position) return null;
  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

function isWordCharacter(value: string) {
  return /[A-Za-z'-]/.test(value);
}

export function wordAtPoint(document: Document, event: MouseEvent): ClickWord | null {
  const point = pointRange(document, event);
  if (!point || point.startContainer.nodeType !== Node.TEXT_NODE) return null;
  if ((point.startContainer.parentElement?.closest('a, ruby, rt') != null)) return null;

  const text = point.startContainer.textContent ?? '';
  let start = Math.min(point.startOffset, text.length);
  let end = start;
  while (start > 0 && isWordCharacter(text[start - 1])) start -= 1;
  while (end < text.length && isWordCharacter(text[end])) end += 1;
  const word = text.slice(start, end);
  if (!/[A-Za-z]/.test(word)) return null;

  const range = document.createRange();
  range.setStart(point.startContainer, start);
  range.setEnd(point.startContainer, end);
  return { range, word };
}

export function surroundingText(range: Range, radius = 36) {
  const node = range.startContainer;
  const text = node.textContent ?? '';
  const start = range.startOffset;
  const end = range.endOffset;
  return {
    quote: range.toString(),
    prefix: text.slice(Math.max(0, start - radius), start),
    suffix: text.slice(end, end + radius),
  };
}
