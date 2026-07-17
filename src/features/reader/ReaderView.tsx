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

interface SelectionState {
  range: Range;
  cfi: string;
  surface: string;
  clientRect: DOMRect;
}

interface LookupState {
  entry: DictionaryEntry;
  surface: string;
  cfi: string;
  range: Range;
}

const EPUB_OPEN_TIMEOUT_MS = 20_000;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== '{}' ? serialized : '未知错误';
  } catch {
    return '未知错误';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`加载超过 ${timeoutMs / 1000} 秒`)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function ReaderView({ book, onBack, onNotice }: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const epubRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const contentsRef = useRef<EpubContents | null>(null);
  const currentHrefRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setAnnotations] = useState<Annotation[]>(() => localDb.listAnnotations(book.id));
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [fontSize, setFontSize] = useState(100);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [margin, setMargin] = useState(24);
  const [pageLabel, setPageLabel] = useState('');
  const [progress, setProgress] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toc, setToc] = useState<Array<{ label: string; href: string }>>([]);
  const [showToc, setShowToc] = useState(false);

  useEffect(() => {
    let disposed = false;
    let settled = false;
    const dictionary = new DictionaryService();

    const fail = (reason: unknown) => {
      if (disposed || settled) return;
      settled = true;
      const detail = errorMessage(reason);
      console.error('[Glossary] EPUB open failed:', reason);
      onNotice(`EPUB 打开失败：${detail}`);
      setIsLoading(false);
    };

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
      const onOpenFailed = (reason: unknown) => fail(reason);
      epubBook.on('openFailed', onOpenFailed);
      const rendition = epubBook.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        manager: 'default',
      });
      epubRef.current = epubBook;
      renditionRef.current = rendition;
      applyTheme(rendition, isDark);
      rendition.themes.fontSize(`${fontSize}%`);

      const metadata = await epubBook.loaded.metadata;
      if (metadata.title) {
        document.title = `${metadata.title} · Glossary`;
      }
      const tocItems = await epubBook.navigation;
      if (!disposed) setToc(tocItems.toc.map((item: { label: string; href: string }) => ({ label: item.label, href: item.href })));

      rendition.hooks.content.register((contents) => {
        contentsRef.current = contents;
        renderAnnotations(contents, localDb.listAnnotations(book.id));
        attachSelectionHandlers(contents, dictionary);
      });

      rendition.on('relocated', (location) => {
        const cfi = location.start?.cfi;
        const href = location.start?.href ?? '';
        currentHrefRef.current = href;
        const displayed = location.start?.displayed;
        setPageLabel(displayed?.page && displayed?.total ? `${displayed.page} / ${displayed.total}` : '');
        setProgress(location.start?.percentage ?? 0);
        localDb.saveProgress({ bookId: book.id, cfi, href, percentage: location.start?.percentage ?? 0 });
      });
      rendition.on('rendered', (_section, view) => {
        contentsRef.current = view.contents;
        renderAnnotations(view.contents, localDb.listAnnotations(book.id));
        attachSelectionHandlers(view.contents, dictionary);
        setIsLoading(false);
      });

      const progress = localDb.getProgress(book.id);
      await withTimeout((async () => {
        await epubBook.loaded.metadata;
        await rendition.display(progress?.cfi);
      })(), EPUB_OPEN_TIMEOUT_MS);
      if (!disposed) {
        settled = true;
        setIsLoading(false);
      }
    }

    function applyTheme(rendition: EpubRendition, dark: boolean) {
      rendition.themes.register('glossary-light', {
        body: {
          color: '#29251f !important',
          background: '#f7f3eb !important',
          'font-family': 'Iowan Old Style, Georgia, serif !important',
          'font-weight': '600 !important',
          'line-height': `${lineHeight} !important`,
        },
        'body, body *': { 'font-weight': '600 !important' },
        'a': { color: '#936d42 !important' },
      });
      rendition.themes.register('glossary-dark', {
        body: {
          color: '#e8dfd1 !important',
          background: '#22201d !important',
          'font-family': 'Iowan Old Style, Georgia, serif !important',
          'font-weight': '600 !important',
          'line-height': `${lineHeight} !important`,
        },
        'body, body *': { 'font-weight': '600 !important' },
        'a': { color: '#ddb581 !important' },
      });
      rendition.themes.select(dark ? 'glossary-dark' : 'glossary-light');
    }

    function attachSelectionHandlers(contents: EpubContents, dictionary: DictionaryService) {
      const doc = contents.document;
      let longPressTimer: number | null = null;

      const clearSelection = () => {
        if (longPressTimer) window.clearTimeout(longPressTimer);
        longPressTimer = null;
        setSelection(null);
      };

      const onPointerDown = (event: PointerEvent) => {
        if (longPressTimer) window.clearTimeout(longPressTimer);
        longPressTimer = window.setTimeout(() => {
          const clicked = wordAtPoint(doc, event);
          if (clicked) {
            const range = clicked.range;
            const selection = doc.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            showSelectionMenu(contents, range, clicked.word, dictionary);
          }
        }, 350);
      };

      const onPointerUp = () => {
        if (longPressTimer) window.clearTimeout(longPressTimer);
        longPressTimer = null;
        const sel = doc.getSelection();
        if (sel && !sel.isCollapsed) {
          showSelectionMenu(contents, sel.getRangeAt(0), sel.toString().trim(), dictionary);
        }
      };

      const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest('.glossary-annotation')) return;
        clearSelection();
      };

      doc.addEventListener('pointerdown', onPointerDown);
      doc.addEventListener('pointerup', onPointerUp);
      doc.addEventListener('click', onClick);
    }

    function showSelectionMenu(contents: EpubContents, range: Range, surface: string, dictionary: DictionaryService) {
      const rect = range.getBoundingClientRect();
      const cfi = cfiFromRange(contents, range, 'glossary-annotation') ?? '';
      setSelection({ range, cfi, surface, clientRect: rect });
      const entry = dictionary.lookup(surface);
      if (entry) {
        setLookup({ entry, surface, cfi, range });
      } else {
        setLookup(null);
      }
    }

    void mountReader().catch((reason) => fail(reason));

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
    applyTheme(renditionRef.current, isDark);
  }, [isDark, lineHeight]);

  function applyTheme(rendition: EpubRendition | null, dark: boolean) {
    if (!rendition) return;
    rendition.themes.register('glossary-light', {
      body: {
        color: '#29251f !important',
        background: '#f7f3eb !important',
        'font-family': 'Iowan Old Style, Georgia, serif !important',
        'font-weight': '600 !important',
        'line-height': `${lineHeight} !important`,
        padding: `${margin}px !important`,
      },
      'body, body *': { 'font-weight': '600 !important' },
      'a': { color: '#936d42 !important' },
    });
    rendition.themes.register('glossary-dark', {
      body: {
        color: '#e8dfd1 !important',
        background: '#22201d !important',
        'font-family': 'Iowan Old Style, Georgia, serif !important',
        'font-weight': '600 !important',
        'line-height': `${lineHeight} !important`,
        padding: `${margin}px !important`,
      },
      'body, body *': { 'font-weight': '600 !important' },
      'a': { color: '#ddb581 !important' },
    });
    rendition.themes.select(dark ? 'glossary-dark' : 'glossary-light');
  }

  function saveGlossFromLookup() {
    if (!lookup || !contentsRef.current) return;
    const context = contextAround(lookup.range);
    const annotation = saveAnnotation(book.id, {
      href: currentHrefRef.current,
      cfi: lookup.cfi,
      quote: lookup.surface,
      prefix: context.prefix,
      suffix: context.suffix,
    }, lookup.entry);
    setAnnotations(localDb.listAnnotations(book.id));
    renderAnnotations(contentsRef.current, localDb.listAnnotations(book.id));
    onNotice(`已保存：${annotation.translation}`);
    setSelection(null);
  }


  function gotoChapter(href: string) {
    void renditionRef.current?.display(href);
    setShowToc(false);
  }

  function seekProgress(event: React.MouseEvent<HTMLDivElement>) {
    const bar = event.currentTarget;
    const ratio = (event.clientX - bar.getBoundingClientRect().left) / bar.clientWidth;
    const target = Math.max(0, Math.min(1, ratio));
    void renditionRef.current?.display(String(target));
  }

  const menuPosition = selection?.clientRect;

  return (
    <section className={`reader-page ${isDark ? 'reader-dark' : ''}`}>
      <header className="reader-toolbar">
        <button className="icon-button" onClick={onBack} aria-label="返回书库">←</button>
        <div className="reader-controls">
          <button className="toolbar-button" onClick={() => setShowToc(true)} aria-label="目录">目录</button>
          <button className="toolbar-button" onClick={() => setShowSettings(true)} aria-label="Aa">Aa</button>
          <button className="toolbar-button" onClick={() => setIsDark((value) => !value)}>{isDark ? '浅色' : '深色'}</button>
        </div>
      </header>

      <div className="reader-main">
        <button className="page-button" onClick={() => void renditionRef.current?.prev()} aria-label="上一页">‹</button>
        <div ref={containerRef} className="epub-container" aria-label="EPUB 阅读区域" />
        <button className="page-button" onClick={() => void renditionRef.current?.next()} aria-label="下一页">›</button>
        {isLoading && <div className="reader-loading">正在打开书籍…</div>}

        {menuPosition && (
          <div
            className="selection-menu"
            style={{ top: menuPosition.top - 48, left: Math.max(8, menuPosition.left + menuPosition.width / 2 - 80) }}
          >
            {lookup ? (
              <>
                <button onClick={saveGlossFromLookup}>保存译注</button>
                <button onClick={() => navigator.clipboard?.writeText(selection?.surface ?? '')}>复制</button>
              </>
            ) : (
              <button onClick={() => navigator.clipboard?.writeText(selection?.surface ?? '')}>复制</button>
            )}
          </div>
        )}
      </div>

      <footer className="reader-footer">
        <div className="progress-bar" onClick={seekProgress}>
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="page-label">{pageLabel ? `第 ${pageLabel} 页 · ${Math.round(progress * 100)}%` : `${Math.round(progress * 100)}%`}</span>
      </footer>

      {lookup && (
        <aside className="lookup-drawer" role="dialog" aria-label="词典释义">
          <div className="lookup-header">
            <strong>{lookup.surface}</strong>
            <span>{lookup.entry.phonetic} · {lookup.entry.pos}</span>
            <button className="close-button" onClick={() => setLookup(null)} aria-label="关闭">×</button>
          </div>
          <p className="lookup-brief">{lookup.entry.briefZh}</p>
          <ol>{lookup.entry.definitions.map((definition) => <li key={definition}>{definition}</li>)}</ol>
          <div className="lookup-actions">
            <button className="button button-primary" onClick={saveGlossFromLookup}>保存译注</button>
            <button className="button" onClick={() => onNotice('已加入生词本')}>加入生词本</button>
          </div>
        </aside>
      )}

      {showSettings && (
        <aside className="settings-drawer" role="dialog" aria-label="阅读设置">
          <div className="drawer-header">
            <strong>阅读设置</strong>
            <button className="close-button" onClick={() => setShowSettings(false)} aria-label="关闭">×</button>
          </div>
          <div className="setting-row">
            <span>字号</span>
            <button className="toolbar-button" onClick={() => setFontSize((size) => Math.max(80, size - 10))}>A−</button>
            <span className="font-size-label">{fontSize}%</span>
            <button className="toolbar-button" onClick={() => setFontSize((size) => Math.min(150, size + 10))}>A+</button>
          </div>
          <div className="setting-row">
            <span>行距</span>
            {([1.4, 1.6, 1.8, 2.0] as const).map((value) => (
              <button key={value} className={`toolbar-button ${lineHeight === value ? 'active' : ''}`} onClick={() => setLineHeight(value)}>{value}</button>
            ))}
          </div>
          <div className="setting-row">
            <span>页边距</span>
            {([12, 24, 40] as const).map((value) => (
              <button key={value} className={`toolbar-button ${margin === value ? 'active' : ''}`} onClick={() => setMargin(value)}>{value === 12 ? '窄' : value === 24 ? '中' : '宽'}</button>
            ))}
          </div>
        </aside>
      )}

      {showToc && (
        <aside className="toc-drawer" role="dialog" aria-label="目录">
          <div className="drawer-header">
            <strong>目录</strong>
            <button className="close-button" onClick={() => setShowToc(false)} aria-label="关闭">×</button>
          </div>
          <nav className="toc-list">
            {toc.map((item) => (
              <button key={item.href} className="toc-item" onClick={() => gotoChapter(item.href)}>{item.label}</button>
            ))}
          </nav>
        </aside>
      )}
    </section>
  );
}
