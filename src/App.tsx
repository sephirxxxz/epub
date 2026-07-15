import { useEffect, useMemo, useState } from 'react';
import { LibraryView } from './features/library/LibraryView';
import { ReaderView } from './features/reader/ReaderView';
import type { BookSummary } from './db/models';
import './styles/app.css';

export function App() {
  const [selectedBook, setSelectedBook] = useState<BookSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const content = useMemo(() => {
    if (selectedBook) {
      return (
        <ReaderView
          book={selectedBook}
          onBack={() => setSelectedBook(null)}
          onNotice={setNotice}
        />
      );
    }

    return (
      <LibraryView
        onOpen={setSelectedBook}
        onNotice={setNotice}
      />
    );
  }, [selectedBook]);

  return (
    <main className="app-shell">
      {content}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
