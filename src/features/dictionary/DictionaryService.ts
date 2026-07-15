import generatedDictionary from '../../data/dictionary.json';
import type { DictionaryEntry } from '../../db/models';
import { localDb } from '../../db/localDb';

const irregular: Record<string, string> = {
  was: 'be', were: 'be', been: 'be', went: 'go', gone: 'go', saw: 'see', seen: 'see',
  ran: 'run', run: 'run', had: 'have', did: 'do', done: 'do', better: 'good', best: 'good',
};

export function normalizeWord(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[“”‘’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/gi, '');
}

function candidates(surface: string): string[] {
  const word = normalizeWord(surface);
  const result = [word];
  if (irregular[word]) result.push(irregular[word]);
  if (word.endsWith('ies')) result.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ing')) {
    result.push(word.slice(0, -3));
    result.push(`${word.slice(0, -3)}e`);
  }
  if (word.endsWith('ed')) {
    result.push(word.slice(0, -2));
    result.push(`${word.slice(0, -1)}`);
  }
  if (word.endsWith('es')) result.push(word.slice(0, -2));
  if (word.endsWith('s')) result.push(word.slice(0, -1));
  return [...new Set(result)];
}

const generatedEntries = generatedDictionary as DictionaryEntry[];

export class DictionaryService {
  private readonly entries: Map<string, DictionaryEntry>;

  constructor(entries?: DictionaryEntry[]) {
    const savedEntries = entries ?? localDb.getDictionary();
    this.entries = new Map<string, DictionaryEntry>();
    for (const entry of [...generatedEntries, ...savedEntries]) {
      const key = normalizeWord(entry.word);
      if (key && !this.entries.has(key)) this.entries.set(key, entry);
    }
  }

  lookup(surface: string): DictionaryEntry | undefined {
    for (const candidate of candidates(surface)) {
      const entry = this.entries.get(candidate);
      if (entry) return entry;
    }
    return undefined;
  }
}
