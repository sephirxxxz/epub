export interface BookSummary {
  id: string;
  title: string;
  author: string;
  fileName: string;
  size: number;
  importedAt: string;
  lastOpenedAt?: string;
  progress?: number;
  lastCfi?: string;
  data?: ArrayBuffer;
}

export interface DictionaryEntry {
  word: string;
  lemma: string;
  phonetic?: string;
  pos?: string;
  briefZh: string;
  definitions: string[];
}

export interface Annotation {
  id: string;
  bookId: string;
  href: string;
  cfi: string;
  surface: string;
  lemma: string;
  translation: string;
  detailSnapshot: DictionaryEntry;
  quote: string;
  prefix: string;
  suffix: string;
  hidden: boolean;
  status?: 'active' | 'orphan';
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  bookId: string;
  cfi?: string;
  href?: string;
  percentage: number;
}
