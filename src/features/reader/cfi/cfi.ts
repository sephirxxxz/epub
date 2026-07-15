export function rangeFromCfi(contents: { range(cfi: string): Range }, cfi: string): Range | null {
  try {
    return contents.range(cfi);
  } catch {
    return null;
  }
}

export function cfiFromRange(contents: { cfiFromRange(range: Range): string }, range: Range): string | null {
  try {
    return contents.cfiFromRange(range);
  } catch {
    return null;
  }
}

export function contextAround(range: Range, radius = 32) {
  const text = range.commonAncestorContainer.textContent ?? '';
  const selected = range.toString();
  const index = text.indexOf(selected);
  if (index < 0) return { quote: selected, prefix: '', suffix: '' };
  return {
    quote: selected,
    prefix: text.slice(Math.max(0, index - radius), index),
    suffix: text.slice(index + selected.length, index + selected.length + radius),
  };
}
