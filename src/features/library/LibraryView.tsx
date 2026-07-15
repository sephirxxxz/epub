import { useMemo, useState } from 'react';
import { localDb, createId } from '../../db/localDb';
import { deleteBookFile, saveBookFile } from '../../db/bookFiles';
import type { BookSummary } from '../../db/models';

interface LibraryViewProps {
  onOpen: (book: BookSummary) => void;
  onNotice: (notice: string) => void;
}

export function LibraryView({ onOpen, onNotice }: LibraryViewProps) {
  const [books, setBooks] = useState(() => localDb.listBooks());
  const [isDragging, setIsDragging] = useState(false);

  const empty = useMemo(() => books.length === 0, [books.length]);

  async function importBook(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.epub')) {
      onNotice('目前只支持 EPUB 文件');
      return;
    }

    const data = await file.arrayBuffer();
    const id = createId('book');
    const book: BookSummary = {
      id,
      title: file.name.replace(/\.epub$/i, ''),
      author: '未知作者',
      fileName: file.name,
      size: file.size,
      importedAt: new Date().toISOString(),
      data,
    };
    localDb.saveBook({ ...book, data: undefined });
    await saveBookFile(id, data);
    setBooks(localDb.listBooks());
    onNotice('书籍已加入本地书库');
  }

  function removeBook(book: BookSummary) {
    if (!window.confirm(`从书库移除《${book.title}》？`)) return;
    localDb.removeBook(book.id);
    void deleteBookFile(book.id);
    setBooks(localDb.listBooks());
  }

  return (
    <section className="library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">OFFLINE READER</p>
          <h1>我的书库</h1>
          <p className="muted">只读本地 EPUB，单击单词即可留下中文译注。</p>
        </div>
        <label className="button button-primary">
          导入 EPUB
          <input
            type="file"
            accept=".epub,application/epub+zip"
            hidden
            onChange={(event) => void importBook(event.target.files?.[0])}
          />
        </label>
      </header>

      <div
        className={`drop-zone ${isDragging ? 'drop-zone-active' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void importBook(event.dataTransfer.files[0]);
        }}
      >
        {empty ? (
          <>
            <strong>把 EPUB 拖到这里</strong>
            <span>原始文件不会被修改，译注保存在应用本地。</span>
          </>
        ) : (
          <span>继续导入书籍，或从下方选择一本开始阅读。</span>
        )}
      </div>

      <div className="book-grid">
        {books.map((book) => (
          <article className="book-card" key={book.id}>
            <button className="book-cover" onClick={() => onOpen(book)} aria-label={`打开《${book.title}》`}>
              <span className="book-cover-mark">G</span>
              <span>{book.title}</span>
            </button>
            <div className="book-card-body">
              <h2>{book.title}</h2>
              <p>{book.author}</p>
              <div className="book-card-actions">
                <button className="text-button" onClick={() => onOpen(book)}>打开</button>
                <button className="text-button danger" onClick={() => removeBook(book)}>移除</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
