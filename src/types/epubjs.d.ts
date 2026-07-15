declare module 'epubjs' {
  export interface EpubLocation {
    start?: { cfi?: string; href?: string; percentage?: number };
    end?: { cfi?: string; href?: string; percentage?: number };
  }

  export interface EpubContents {
    document: Document;
    window: Window;
    cfiFromRange(range: Range): string;
    range(cfi: string): Range;
  }

  export interface EpubRendition {
    display(target?: string): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    resize(width?: number, height?: number): void;
    themes: {
      register(name: string, styles: Record<string, string | Record<string, string>>): void;
      select(name: string): void;
      fontSize(size: string): void;
    };
    hooks: { content: { register(callback: (contents: EpubContents) => void): void } };
    on(event: 'relocated', callback: (location: EpubLocation) => void): void;
    on(event: 'rendered', callback: (section: unknown, view: { contents: EpubContents }) => void): void;
    destroy(): void;
  }

  export interface EpubBook {
    rendition: (element: HTMLElement, options?: Record<string, unknown>) => EpubRendition;
    loaded: { metadata: Promise<{ title?: string; creator?: string }> };
    navigation: Promise<{ toc: Array<{ label: string; href: string; subitems?: unknown[] }> }>;
    spine: { get(target: string): unknown };
    destroy(): void;
  }

  export default function ePub(data: ArrayBuffer | string): EpubBook;
}
