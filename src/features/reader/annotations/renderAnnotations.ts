import type { Annotation } from '../../../db/models';
import { rangeFromCfi } from '../cfi/cfi';

type EpubContents = {
  document: Document;
  range(cfi: string, ignoreClass?: string): Range;
};

const ANNOTATION_CLASS = 'glossary-annotation';
const ORIGINAL_CLASS = 'glossary-original';
const TRANSLATION_CLASS = 'glossary-translation';

function unwrapGlosses(document: Document) {
  document.querySelectorAll<HTMLElement>(`.${ANNOTATION_CLASS}`).forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    const original = node.querySelector<HTMLElement>(`.${ORIGINAL_CLASS}`);
    if (original) {
      while (original.firstChild) parent.insertBefore(original.firstChild, node);
    } else {
      Array.from(node.childNodes)
        .filter((child) => !(child instanceof Element && child.classList.contains(TRANSLATION_CLASS)))
        .forEach((child) => parent.insertBefore(child, node));
    }
    parent.removeChild(node);
  });
}

function createGlossNode(document: Document, annotation: Annotation, fragment: DocumentFragment) {
  const ruby = document.createElement('ruby');
  ruby.className = ANNOTATION_CLASS;
  ruby.dataset.annotationId = annotation.id;
  ruby.title = `${annotation.surface} · 双击查看详情`;

  const original = document.createElement('span');
  original.className = ORIGINAL_CLASS;
  original.append(fragment);

  const gloss = document.createElement('rt');
  gloss.className = TRANSLATION_CLASS;
  gloss.textContent = annotation.translation;
  ruby.append(original, gloss);
  return ruby;
}

function wrapRange(range: Range, annotation: Annotation, document: Document) {
  if (range.collapsed || range.commonAncestorContainer.nodeType !== Node.TEXT_NODE) return false;
  const fragment = range.extractContents();
  range.insertNode(createGlossNode(document, annotation, fragment));
  return true;
}

export function renderAnnotations(contents: EpubContents, annotations: Annotation[]) {
  unwrapGlosses(contents.document);
  const active = annotations.filter((annotation) => !annotation.hidden && annotation.status !== 'orphan');
  // Apply from the end so offsets in a shared text node do not shift before later ranges.
  for (const annotation of [...active].reverse()) {
    const range = rangeFromCfi(contents, annotation.cfi, ANNOTATION_CLASS);
    if (!range) continue;
    wrapRange(range, annotation, contents.document);
  }
}
