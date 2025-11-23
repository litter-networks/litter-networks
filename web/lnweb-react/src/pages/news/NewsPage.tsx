import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNewsItems, formatNewsDate, type NewsItem } from '@/data-sources/news';
import { usePageTitle } from '@/shared/usePageTitle';
import styles from './styles/news.module.css';

/**
 * Render the NewsPage component that displays an infinite-scroll list of news items.
 *
 * Sets the page title to "News", fetches and appends paginated news items as the user scrolls,
 * and surfaces a loading indicator, end-of-list message, or an error message as appropriate.
 *
 * @returns A React element containing the news list, loading indicator, end-of-list text, and any error message.
 */
export function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  usePageTitle('News');

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const lastIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchNewsItems(lastIdRef.current, signal);
      if (!isMountedRef.current) {
        return;
      }
      setItems((prev) => {
        const next = [...prev, ...data];
        lastIdRef.current = next[next.length - 1]?.uniqueId;
        return next;
      });

      if (!data.length) {
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch (err) {
      if (signal.aborted || !isMountedRef.current) {
        return;
      }
      console.error('Failed to load news', err);
      setError(err instanceof Error ? err.message : 'Unable to load news');
    } finally {
      loadingRef.current = false;
      if (!signal.aborted && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollableHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrolled = window.scrollY + viewportHeight;
      if (scrollableHeight - scrolled < 120) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  return (
    <div className={styles.page}>
      <table className={styles.newsTable}>
        <tbody>
          {items.map((item, index) => (
            <NewsRow key={item.uniqueId ?? `${item.sourceUrl}-${index}`} item={item} />
          ))}
        </tbody>
      </table>

      <div className={styles.loadingSection}>
        {loading && (
          <div className={styles.loadingIndicator}>
            <div className={styles.spinner} />
          </div>
        )}
        {!hasMore && (
          <p className={styles.endText}>That&apos;s everything for now — check back soon!</p>
        )}
        {error && !loading && <p className={styles.errorText}>{error}</p>}
      </div>
    </div>
  );
}

/**
 * Render a table row that displays a single news item as responsive landscape and portrait cards linking to the original source.
 *
 * @param item - The NewsItem to render (provides site name, title, description, images, article date, source URL, and uniqueId)
 * @returns A `<tr>` element containing the card layouts and an anchor that opens the item's source in a new browser tab
 */
function NewsRow({ item }: { item: NewsItem }) {
  const formattedDate = formatNewsDate(item.articleDate);

  return (
    <tr className={styles.newsEntryRow} id={item.uniqueId}>
      <td>
        <a className={styles.newsLink} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
          <div className={`${styles.card} ${styles.landscapeCard}`}>
            <div className={`${styles.blockHeader} ${styles.blockHeaderLarge}`}>
              <span className={styles.externalIcon}>
                <img src="/icons/icon-external-link.svg" alt="" className={styles.externalIconImg} />
              </span>
              <span className={styles.sourceText}>{item.siteName}</span>
              <span className={styles.dateText}>{formattedDate}</span>
            </div>
            <div className={styles.landscapeContent}>
              <img className={styles.itemImage} src={item.imageUrl} alt={item.title} loading="lazy" />
              <div>
                <h1 className={styles.itemTitle}>{item.title}</h1>
                <h3 className={styles.itemDescription}>{item.description}</h3>
              </div>
            </div>
          </div>
          <div className={`${styles.card} ${styles.portraitCard}`}>
            <div className={styles.blockHeader}>
              <span className={styles.sourceText}>{item.siteName}</span>
              <span className={styles.dateTextSmall}>{formattedDate}</span>
              <span className={styles.externalIcon}>
                <img src="/icons/icon-external-link.svg" alt="" className={styles.externalIconImg} />
              </span>
            </div>
            <div className={styles.portraitContent}>
              <h1 className={`${styles.itemTitle} ${styles.itemTitleSmall}`}>{item.title}</h1>
              <img
                className={`${styles.itemImage} ${styles.itemImageFull}`}
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
              />
              <h3 className={`${styles.itemDescription} ${styles.itemDescriptionSmall}`}>{item.description}</h3>
            </div>
          </div>
        </a>
      </td>
    </tr>
  );
}