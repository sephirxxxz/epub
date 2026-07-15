import fs from 'node:fs';
import path from 'node:path';

type Row = Record<string, string>;

function parseCsv(csv: string): Row[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      record.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      record.push(field);
      field = '';
      if (record.some(Boolean)) records.push(record);
      record = [];
    } else {
      field += character;
    }
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  const headers = records.shift() ?? [];
  return records.map((values) => Object.fromEntries(values.map((value, index) => [headers[index], value])));
}

function buildDictionary(sourcePath: string, outputPath: string, limit: number) {
  const rows = parseCsv(fs.readFileSync(sourcePath, 'utf8'));
  const usable = rows
    .map((row) => ({ row, word: row.word?.trim().toLocaleLowerCase(), frequency: Number(row.frq) || 0 }))
    .filter(({ row, word, frequency }) => Boolean(word && row.translation?.trim() && /[a-z]/i.test(word) && frequency > 0))
    .sort((a, b) => a.frequency - b.frequency || a.word.localeCompare(b.word));

  const seen = new Set<string>();
  const entries = usable.flatMap(({ row, word }) => {
    if (seen.has(word)) return [];
    seen.add(word);
    const translation = row.translation.trim().replace(/\s+/g, ' ');
    const definitions = translation.split(/\s*\n\s*|(?<=；)\s+/).filter(Boolean).slice(0, 8);
    return [{
      word,
      lemma: word,
      phonetic: row.phonetic?.trim() || null,
      pos: row.pos?.trim() || null,
      briefZh: (definitions[0] || translation).slice(0, 120),
      definitions: definitions.length ? definitions : [translation.slice(0, 240)],
      exchange: row.exchange?.trim() || null,
    }];
  }).slice(0, limit);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(entries)}\n`);
  console.log(`Generated ${entries.length} entries at ${outputPath}`);
}

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? path.resolve('src/data/dictionary.json');
const limit = Number(process.argv[4] ?? 30_000);
if (!sourcePath || !Number.isFinite(limit) || limit < 1) {
  console.error('Usage: npm run build:dictionary -- <ecdict.csv> [output.json] [limit]');
  process.exit(1);
}
buildDictionary(path.resolve(sourcePath), path.resolve(outputPath), limit);
