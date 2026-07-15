import type { Annotation, DictionaryEntry } from '../../../db/models';
import { createId, localDb } from '../../../db/localDb';

export interface WordLocation {
  href: string;
  cfi: string;
  quote: string;
  prefix: string;
  suffix: string;
}

export function createAnnotation(bookId: string, location: WordLocation, entry: DictionaryEntry): Annotation {
  const timestamp = new Date().toISOString();
  return {
    id: createId('annotation'),
    bookId,
    href: location.href,
    cfi: location.cfi,
    surface: location.quote,
    lemma: entry.lemma,
    translation: entry.briefZh,
    detailSnapshot: entry,
    quote: location.quote,
    prefix: location.prefix,
    suffix: location.suffix,
    hidden: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function saveAnnotation(bookId: string, location: WordLocation, entry: DictionaryEntry) {
  return localDb.upsertAnnotation(createAnnotation(bookId, location, entry));
}
