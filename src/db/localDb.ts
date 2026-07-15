import type { Annotation, BookSummary, DictionaryEntry, ReadingProgress } from './models';

const BOOKS_KEY = 'glossary.books';
const ANNOTATIONS_KEY = 'glossary.annotations';
const PROGRESS_KEY = 'glossary.progress';
const DICTIONARY_KEY = 'glossary.dictionary';

const now = () => new Date().toISOString();

const memoryStorage = new Map<string, string>();

function storageGet(key: string) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    // Fall back to the in-memory store in restricted/webview test contexts.
  }
  return memoryStorage.get(key) ?? null;
}

function storageSet(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fall back to the in-memory store in restricted/webview test contexts.
  }
  memoryStorage.set(key, value);
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = storageGet(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  storageSet(key, JSON.stringify(value));
}

export const localDb = {
  listBooks(): BookSummary[] {
    return read<BookSummary[]>(BOOKS_KEY, []).sort((a, b) =>
      (b.lastOpenedAt ?? b.importedAt).localeCompare(a.lastOpenedAt ?? a.importedAt),
    );
  },

  saveBook(book: BookSummary) {
    const books = read<BookSummary[]>(BOOKS_KEY, []).filter((item) => item.id !== book.id);
    write(BOOKS_KEY, [...books, book]);
  },

  removeBook(bookId: string) {
    write(BOOKS_KEY, read<BookSummary[]>(BOOKS_KEY, []).filter((book) => book.id !== bookId));
    write(ANNOTATIONS_KEY, read<Annotation[]>(ANNOTATIONS_KEY, []).filter((item) => item.bookId !== bookId));
    write(PROGRESS_KEY, read<ReadingProgress[]>(PROGRESS_KEY, []).filter((item) => item.bookId !== bookId));
  },

  getProgress(bookId: string): ReadingProgress | undefined {
    return read<ReadingProgress[]>(PROGRESS_KEY, []).find((item) => item.bookId === bookId);
  },

  saveProgress(progress: ReadingProgress) {
    const all = read<ReadingProgress[]>(PROGRESS_KEY, []).filter((item) => item.bookId !== progress.bookId);
    write(PROGRESS_KEY, [...all, progress]);
  },

  listAnnotations(bookId: string): Annotation[] {
    return read<Annotation[]>(ANNOTATIONS_KEY, []).filter((item) => item.bookId === bookId);
  },

  upsertAnnotation(annotation: Annotation): Annotation {
    const all = read<Annotation[]>(ANNOTATIONS_KEY, []);
    const existingIndex = all.findIndex((item) => item.bookId === annotation.bookId && item.cfi === annotation.cfi);
    if (existingIndex >= 0) all[existingIndex] = { ...all[existingIndex], ...annotation, updatedAt: now() };
    else all.push(annotation);
    write(ANNOTATIONS_KEY, all);
    return existingIndex >= 0 ? all[existingIndex] : annotation;
  },

  updateAnnotation(id: string, patch: Partial<Annotation>) {
    const all = read<Annotation[]>(ANNOTATIONS_KEY, []);
    write(ANNOTATIONS_KEY, all.map((item) => item.id === id ? { ...item, ...patch, updatedAt: now() } : item));
  },

  deleteAnnotation(id: string) {
    write(ANNOTATIONS_KEY, read<Annotation[]>(ANNOTATIONS_KEY, []).filter((item) => item.id !== id));
  },

  getDictionary(): DictionaryEntry[] {
    return read<DictionaryEntry[]>(DICTIONARY_KEY, defaultDictionary);
  },

  setDictionary(entries: DictionaryEntry[]) {
    write(DICTIONARY_KEY, entries);
  },
};

const defaultDictionary: DictionaryEntry[] = [
  { word: 'ambiguous', lemma: 'ambiguous', phonetic: '/æmˈbɪɡjuəs/', pos: 'adj.', briefZh: '模棱两可的', definitions: ['模棱两可的；不明确的', '含义不清楚的'] },
  { word: 'elaborate', lemma: 'elaborate', phonetic: '/ɪˈlæbərət/', pos: 'adj.', briefZh: '详尽的', definitions: ['详尽的；复杂的', '精心制作的'] },
  { word: 'exhausted', lemma: 'exhaust', phonetic: '/ɪɡˈzɔːstɪd/', pos: 'adj.', briefZh: '筋疲力尽的', definitions: ['筋疲力尽的；疲惫的'] },
  { word: 'novel', lemma: 'novel', phonetic: '/ˈnɑːvəl/', pos: 'adj./n.', briefZh: '新颖的；小说', definitions: ['新颖的；新奇的', '小说'] },
  { word: 'subtle', lemma: 'subtle', phonetic: '/ˈsʌtl/', pos: 'adj.', briefZh: '微妙的', definitions: ['微妙的；不明显的', '难以察觉的'] },
  { word: 'look', lemma: 'look', phonetic: '/lʊk/', pos: 'v.', briefZh: '看；看起来', definitions: ['看；注视', '看起来'] },
];

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
