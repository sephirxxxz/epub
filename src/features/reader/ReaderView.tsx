import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import type { EpubBook, EpubContents, EpubRendition } from 'epubjs';
import { loadBookFile } from '../../db/bookFiles';
import { localDb } from '../../db/localDb';
import type { Annotation, BookSummary, DictionaryEntry } from '../../db/models';
import { DictionaryService } from '../dictionary/DictionaryService';
import { cfiFromRange, contextAround } from './cfi/cfi';
import { renderAnnotations } from './annotations/renderAnnotations';
import { saveAnnotation } from './annotations/annotationStore';
import { wordAtPoint } from './wordInteraction';

interface ReaderViewProps {
  book: BookSummary;
  onBack: () => void;
  onNotice: (notice: string) => void;
}

interface DetailState {
  entry: DictionaryEntry;
  annotation?: Annotation;
}

export function ReaderView({ book, onBack, onNotice }: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const epubRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const contentsRef = useRef<EpubContents | null>(null);
  const currentHrefRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => localDb.listAnnotations(book.id));
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [translationDraft, setTranslationDraft] = useState('');
  const [fontSize, setFontSize] = useState(100);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let disposed = false;
    const dictionary = new DictionaryService();

    async function mountReader() {
      const data = await loadBookFile(book.id);
      if (disposed) return;
      if (!data) {
        onNotice('找不到书籍文件，请重新导入 EPUB');
        onBack();
        return;
      }
      if (!containerRef.current) return;

      const epubBook = ePub(data);
      const rendition = epubBook.rendition(containerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        manager: 'default',
      });
      epubRef.current = epubBook;
      renditionRef.current = rendition;
      rendition.themes.register('glossary-light', {
        body: { color: '#29251f !important', background: '#f7f3eb !important', 'font-family': 'Iowan Old Style, Georgia, serif !important' },
        'a': { color: '#936d42 !important' },
      });
      rendition.themes.register('glossary-dark', {
        body: { color: '#e8dfd1 !important', background: '#22201d !important', 'font-family': 'Iowan Old Style, Georgia, serif !important' },
        'a': { color: '#ddb581 !important' },
      });
      rendition.themes.select(isDark ? 'glossary-dark' : 'glossary-light');
      rendition.themes.fontSize(`${fontSize}%`);

      rendition.hooks.content.register((contents) => {
        contentsRef.current = contents;
        renderAnnotations(contents, localDb.listAnnotations(book.id));

        let clickTimer: number | null = null;
        const onClick = (event: MouseEvent) => {
          const existing = (event.target as HTMLElement).closest<HTMLElement>('.glossary-annotation');
          if (existing?.dataset.annotationId) {
            const found = localDb.listAnnotations(book.id).find((item) => item.id === existing.dataset.annotationId);
            if (found) {
              if (clickTimer) window.clearTimeout(clickTimer);
              clickTimer = window.setTimeout(() => setDetail({ entry: found.detailSnapshot, annotation: found }), 220);
              return;
            }
          }

          const clicked = wordAtPoint(contents.document, event);
          if (!clicked) return;
          if (clickTimer) window.clearTimeout(clickTimer);
          clickTimer = window.setTimeout(() => {
            const entry = dictionary.lookup(clicked.word);
            if (!entry) {
              onNotice(`本地词典没有找到 “${clicked.word}”`);
              return;
            }
            const cfi = cfiFromRange(contents, clicked.range);
            if (!cfi) {
              onNotice('无法保存这个词的位置');
              return;
            }
            const context = contextAround(clicked.range);
            const annotation = saveAnnotation(book.id, {
              href: currentHrefRef.current,
              cfi,
              ...context,
            }, entry);
            setAnnotations(localDb.listAnnotations(book.id));
            renderAnnotations(contents, localDb.listAnnotations(book.id));
            onNotice(`已保存：${entry.briefZh}`);
            void annotation;
          }, 220);
        };
        const onDoubleClick = (event: MouseEvent) => {
          if (clickTimer) window.clearTimeout(clickTimer);
          const existing = (event.target as HTMLElement).closest<HTMLElement>('.glossary-annotation');
          if (existing?.dataset.annotationId) {
            const found = localDb.listAnnotations(book.id).find((item) => item.id === existing.dataset.annotationId);
            if (found) setDetail({ entry: found.detailSnapshot, annotation: found });
            return;
          }
          const clicked = wordAtPoint(contents.document, event);
          if (!clicked) return;
          const entry = dictionary.lookup(clicked.word);
          if (entry) setDetail({ entry });
          else onNotice(`本地词典没有找到 “${clicked.word}”`);
        };
        contents.document.addEventListener('click', onClick);
        contents.document.addEventListener('dblclick', onDoubleClick);
      });

      rendition.on('relocated', (location) => {
        const cfi = location.start?.cfi;
        const href = location.start?.href ?? '';
        currentHrefRef.current = href;
        localDb.saveProgress({ bookId: book.id, cfi, href, percentage: location.start?.percentage ?? 0 });
      });
      rendition.on('rendered', (_section, view) => {
        contentsRef.current = view.contents;
        renderAnnotations(view.contents, localDb.listAnnotations(book.id));
        setIsLoading(false);
      });

      const progress = localDb.getProgress(book.id);
      await epubBook.loaded.metadata;
      await rendition.display(progress?.cfi);
    }

    void mountReader().catch(() => {
      if (!disposed) onNotice('EPUB 打开失败：请确认它是无 DRM 的可重排版 EPUB');
      setIsLoading(false);
    });

    return () => {
      disposed = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      renditionRef.current?.destroy();
      epubRef.current?.destroy();
      renditionRef.current = null;
      epubRef.current = null;
    };
  }, [book.id]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}%`);
  }, [fontSize]);

  useEffect(() => {
    renditionRef.current?.themes.select(isDark ? 'glossary-dark' : 'glossary-light');
  }, [isDark]);

  function updateAnnotation(id: string, patch: Partial<Annotation>) {
    localDb.updateAnnotation(id, patch);
    setAnnotations(localDb.listAnnotations(book.id));
    if (contentsRef.current) renderAnnotations(contentsRef.current, localDb.listAnnotations(book.id));
  }

  function deleteCurrentAnnotation() {
    if (!detail?.annotation) return;
    localDb.deleteAnnotation(detail.annotation.id);
    setAnnotations(localDb.listAnnotations(book.id));
    if (contentsRef.current) renderAnnotations(contentsRef.current, localDb.listAnnotations(book.id));
    setDetail(null);
  }

  return (
    <section className={`reader-page ${isDark ? 'reader-dark' : ''}`}>
      <header className="reader-toolbar">
        <button className="icon-button" onClick={onBack} aria-label="返回书库">←</button>
        <div className="reader-book-title">
          <strong>{book.title}</strong>
          <span>{book.author}</span>
        </div>
        <div className="reader-controls">
          <button className="toolbar-button" onClick={() => setFontSize((size) => Math.max(80, size - 10))}>A−</button>
          <span className="font-size-label">{fontSize}%</span>
          <button className="toolbar-button" onClick={() => setFontSize((size) => Math.min(150, size + 10))}>A+</button>
          <button className="toolbar-button" onClick={() => setIsDark((value) => !value)}>{isDark ? '浅色' : '深色'}</button>
        </div>
      </header>

      <div className="reader-main">
        <button className="page-button" onClick={() => void renditionRef.current?.prev()} aria-label="上一页">‹</button>
        <div ref={containerRef} className="epub-container" aria-label="EPUB 阅读区域" />
        <button className="page-button" onClick={() => void renditionRef.current?.next()} aria-label="下一页">›</button>
        {isLoading && <div className="reader-loading">正在打开书籍…</div>}
        {detail && (
          <aside className="dictionary-card" role="dialog" aria-label="详细词典释义">
            <button className="close-button" onClick={() => setDetail(null)} aria-label="关闭">×</button>
            <p className="dictionary-word">{detail.annotation?.surface ?? detail.entry.word}</p>
            <p className="dictionary-meta">{detail.entry.phonetic} · {detail.entry.pos}</p>
            <p className="dictionary-brief">{detail.annotation?.translation ?? detail.entry.briefZh}</p>
            <ol>{detail.entry.definitions.map((definition) => <li key={definition}>{definition}</li>)}</ol>
            {detail.annotation && (
              <div className="dictionary-actions">
                <label className="translation-editor">
                  <span>译注文字</span>
                  <input
                    value={translationDraft || detail.annotation.translation}
                    onChange={(event) => setTranslationDraft(event.target.value)}
                    aria-label="编辑译注"
                  />
                </label>
                <button className="text-button" onClick={() => {
                  updateAnnotation(detail.annotation!.id, { translation: translationDraft || detail.annotation!.translation });
                  setTranslationDraft('');
                }}>保存修改</button>
                <button className="text-button" onClick={() => updateAnnotation(detail.annotation!.id, { hidden: !detail.annotation!.hidden })}>
                  {detail.annotation.hidden ? '显示译注' : '隐藏译注'}
                </button>
                <button className="text-button danger" onClick={deleteCurrentAnnotation}>删除译注</button>
              </div>
            )}
          </aside>
        )}
      </div>
      <footer className="reader-footer">已保存 {annotations.filter((item) => !item.hidden).length} 条译注 · 单击查词，双击查看详细释义</footer>
    </section>
  );
}
