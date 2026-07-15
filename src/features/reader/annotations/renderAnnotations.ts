import type { Annotation } from '../../../db/models';
import { rangeFromCfi } from '../cfi/cfi';

type EpubContents = {
  document: Document;
  range(cfi: string): Range;
};

const ANNOTATION_CLASS = 'glossary-annotation';

function removeExistingGlosses(document: Document) {
  document.querySelectorAll(`.${ANNOTATION_CLASS}`).forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
    parent.normalize();
  });
}

function createGlossNode(document: Document, annotation: Annotation, text: string) {
  const ruby = document.createElement('ruby');
  ruby.className = ANNOTATION_CLASS;
  ruby.dataset.annotationId = annotation.id;
  ruby.title = `${annotation.surface} · 双击查看详情`;

  const original = document.createElement('span');
  original.className = 'glossary-original';
  original.textContent = text;
  const gloss = document.createElement('rt');
  gloss.className = 'glossary-translation';
  gloss.textContent = annotation.translation;
  ruby.append(original, gloss);
  return ruby;
}

function wrapRange(range: Range, annotation: Annotation, document: Document) {
  if (range.collapsed || range.commonAncestorContainer.nodeType !== Node.TEXT_NODE) return false;
  const textNode = range.commonAncestorContainer;
  const selected = range.toString();
  const fragment = range.extractContents();
  const ruby = createGlossNode(document, annotation, selected);
  ruby.replaceChildren(ruby.querySelector('.glossary-original')!, fragment, ruby.querySelector('.glossary-translation')!);
  range.insertNode(ruby);
  textNode.parentNode?.normalize();
  return true;
}

export function renderAnnotations(contents: EpubContents, annotations: Annotation[]) {
  removeExistingGlosses(contents.document);
  const active = annotations.filter((annotation) => !annotation.hidden && annotation.status !== 'orphan');
  // Apply from the end so offsets in a shared text node do not shift before later ranges.
  for (const annotation of [...active].reverse()) {
    const range = rangeFromCfi(contents, annotation.cfi);
    if (!range) continue;
    wrapRange(range, annotation, contents.document);
  }
}
