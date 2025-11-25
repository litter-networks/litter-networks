import { useEffect, useMemo, useState } from 'react';
import { appEnv } from '@/config/env';
import { useNavData } from '@/features/nav/useNavData';
import type { Network } from '@/data-sources/networks';
import { StatsBoardImage } from '@/components/stats/StatsBoardImage';
import { usePageTitle } from '@/shared/usePageTitle';
import styles from './styles/home.module.css';

type BlockType = 'knowledge' | 'join-in' | 'news';

interface WelcomeBlock {
  link: string;
  blockType: BlockType;
  title: string;
  description: string;
  imageUrl?: string;
  classEx?: string;
  imageClass?: string;
  statsUniqueId?: string;
}

interface GalleryItem {
  url: string;
  captionHtml: string;
}

const galleryItems: GalleryItem[] = [
  {
    url: 'https://cdn.litternetworks.org/proc/images/news/8b65d2745404665d.jpg',
    captionHtml:
      '<b>Litter Networks</b> reach significant landmark for can recycling and raise money for charity!',
  },
  {
    url: 'https://cdn.litternetworks.org/proc/images/news/edf0f3d98ba7d669.jpg',
    captionHtml: 'Litter volunteers break another record during GB Spring Clean!',
  },
  {
    url: 'https://cdn.litternetworks.org/proc/images/news/449f054bd77b562c.jpg',
    captionHtml: '<b>Litter Networks</b> help keep Warrington tidy',
  },
];

const entryClassMap: Record<BlockType, string> = {
  knowledge: 'primary-column-entry-knowledge',
  'join-in': 'primary-column-entry-join-in',
  news: 'primary-column-entry-news',
};

const headerClassMap: Record<BlockType, string> = {
  knowledge: 'block-header-knowledge',
  'join-in': 'block-header-join-in',
  news: 'block-header-news',
};

const css = (name?: string) => (name ? styles[name] ?? name : '');
const cx = (...names: Array<string | undefined>) => names.map(css).filter(Boolean).join(' ');

/**
 * Render the home page as two columns of informational block cards derived from navigation context.
 *
 * The component sets the document title to "Welcome" and selects column content based on the current network (falls back to a default layout when no network is present).
 *
 * @returns The React element tree for the home page containing two columns of block cards.
 */
export function HomePage() {
  const { network, buildPath } = useNavData();
  usePageTitle('Welcome');

  const columns = useMemo(() => {
    if (network) {
      return createNetworkColumns(network);
    }
    return createDefaultColumns();
  }, [network]);

  const stackedBlocks = useMemo(() => interleaveColumns(columns), [columns]);

  return (
    <div className={css('page')}>
      <div className={css('columns')}>
        {columns.map((columnBlocks, columnIndex) => (
          <div className={css('column')} key={`column-${columnIndex}`}>
            {columnBlocks.map((block) => (
              <BlockCard key={`${block.title}-${block.link}`} block={block} buildPath={buildPath} />
            ))}
          </div>
        ))}
      </div>
      <div className={css('mobileStack')}>
        {stackedBlocks.map((block, blockIndex) => (
          <BlockCard key={`${block.title}-${block.link}-${blockIndex}`} block={block} buildPath={buildPath} />
        ))}
      </div>
    </div>
  );
}

interface BlockCardProps {
  block: WelcomeBlock;
  buildPath: (path?: string) => string;
}

/**
 * Render a clickable home-page block card for the given welcome block.
 *
 * Renders the block title, an external-link indicator for external URLs, optional description, and media (image, gallery, or stats image); internal links are resolved via `buildPath` and external links open in a new tab with safe rel attributes.
 *
 * @param block - Metadata for the block (title, link, type, description, image settings).
 * @param buildPath - Function that converts an internal route path into a full href for navigation.
 * @returns The JSX element for the block card.
 */
function BlockCard({ block, buildPath }: BlockCardProps) {
  const isExternal = /^https?:\/\//i.test(block.link);
  const href = isExternal ? block.link : buildPath(block.link);

  const entryClassName = css(entryClassMap[block.blockType]);
  const headerClass = cx(
    headerClassMap[block.blockType],
    !block.description && !block.imageUrl ? 'block-header-noimageordesc' : undefined,
  );

  const hasBody = Boolean(block.description) || Boolean(block.imageUrl);

  return (
    <a className={css('blockLink')} href={href} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <div className={entryClassName}>
        {block.title && (
          <div className={headerClass}>
            <div className={css('block-header-title')}>
              <span>{block.title}</span>
              {isExternal && (
                <span className={css('block-header-icon-external-link')}>
                  <img src="/icons/icon-external-link.svg" className={css('icon-external-link')} alt="External link" />
                </span>
              )}
            </div>
          </div>
        )}
        {hasBody && (
          <div className={css('block-text')}>
            {block.description && <p>{block.description}</p>}
            {block.imageUrl && (
              <BlockMedia block={block} />
            )}
          </div>
        )}
      </div>
    </a>
  );
}

/**
 * Render the appropriate media for a WelcomeBlock: a news gallery, a stats board image, a standard image, or nothing.
 *
 * @param block - The WelcomeBlock whose media should be rendered. If `block.imageUrl` is `'news-block-gallery'` a rotating gallery is rendered; if `block.imageClass` is `'stats-image'` a `StatsBoardImage` is rendered using `block.statsUniqueId` (or `'all'`); if `block.imageUrl` is falsy nothing is rendered.
 * @returns A React element representing the selected media, or `null` when the block has no image configured.
 */
function BlockMedia({ block }: { block: WelcomeBlock }) {
  if (block.imageUrl === 'news-block-gallery') {
    return <NewsGallery items={galleryItems} />;
  }

  if (block.imageClass === 'stats-image') {
    const statsUniqueId = block.statsUniqueId ?? 'all';
    return (
      <StatsBoardImage
        uniqueId={statsUniqueId}
        className={cx(block.imageClass, block.classEx ?? 'block-image-cover')}
        alt=""
        placeholderSrc={block.imageUrl}
      />
    );
  }

  if (!block.imageUrl) {
    return null;
  }

  const classNames = cx(block.imageClass, block.classEx ?? 'block-image-cover');

  const crossOrigin = block.imageClass === 'stats-image' ? 'anonymous' : undefined;

  return (
    <img
      src={block.imageUrl}
      alt=""
      className={classNames}
      crossOrigin={crossOrigin}
      loading="lazy"
    />
  );
}

interface NewsGalleryProps {
  items: GalleryItem[];
}

/**
 * Renders an auto-rotating image gallery that displays one slide at a time with a caption overlay.
 *
 * The gallery advances to the next slide every 8 seconds and renders nothing when `items` is empty.
 *
 * @param items - Array of gallery items; each item must include `url` for the image source and `captionHtml` for the caption markup.
 * @returns The gallery element when `items` contains entries, `null` otherwise.
 */
function NewsGallery({ items }: NewsGalleryProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!items.length) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) {
    return null;
  }

  return (
    <div id="image-gallery" className={css('gallery-container')}>
      {items.map((item, itemIndex) => (
        <div
          key={item.url}
          className={cx('gallery-slide', itemIndex === index ? 'active' : undefined)}
          data-index={itemIndex}
        >
          <img src={item.url} alt="" className={css('gallery-image')} loading="lazy" />
          <div className={css('text-overlay')}>
            <p dangerouslySetInnerHTML={{ __html: `&ldquo;${item.captionHtml}&rdquo;` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Create the default two-column layout of welcome blocks for the home page.
 *
 * The left column includes introductory and join-in blocks; the right column includes news and informational blocks.
 *
 * @returns A tuple `[left, right]` where each element is an array of `WelcomeBlock` representing a column of blocks.
 */
function createDefaultColumns(): WelcomeBlock[][] {
  const left: WelcomeBlock[] = [
    {
      link: 'knowledge/getting-started/how-it-works',
      blockType: 'knowledge',
      title: 'How It Works',
      description: 'Welcome! Learn how we use a Litter Network!',
    },
    {
      link: 'join-in/choose',
      blockType: 'join-in',
      title: 'Join In',
      description: 'Choose a network and get started!',
      imageUrl: `${appEnv.staticAssetsBaseUrl}/images/mockup_map.jpg`,
      classEx: 'block-image-cover-30vh',
    },
    {
      link: 'join-in',
      blockType: 'join-in',
      title: 'Reach Out',
      description: "Get in touch - we'd love to hear from you!",
    },
  ];
  const right: WelcomeBlock[] = [
    {
      link: 'news',
      blockType: 'news',
      title: 'News',
      description: 'Read all about it!',
      imageUrl: 'news-block-gallery',
      classEx: 'block-image-cover-40vh',
    },
    {
      link: 'knowledge/our-organisation/about-us',
      blockType: 'knowledge',
      title: 'About Us',
      description: 'Learn more about us!',
    },
    {
      link: 'knowledge/our-organisation/testimonials',
      blockType: 'knowledge',
      title: 'Testimonials',
      description: 'Here what our partners say about us!',
    },
  ];

  return [left, right];
}

/**
 * Builds the two-column set of welcome blocks tailored for a given network.
 *
 * @param network - Network object whose identifiers and metadata are used to construct network-specific links and image references
 * @returns A two-element array `[leftColumn, rightColumn]` where each element is an array of `WelcomeBlock` objects for that column
 */
function createNetworkColumns(network: Network): WelcomeBlock[][] {
  const facebookLink = `https://www.facebook.com/groups/${network.uniqueId}`;
  const statsImage = `${appEnv.staticAssetsBaseUrl}/images/stats-board.png`;

  const left: WelcomeBlock[] = [
    {
      link: 'knowledge/getting-started/how-it-works',
      blockType: 'knowledge',
      title: 'How It Works',
      description: 'Welcome! Learn how we use a Litter Network!',
    },
    {
      link: facebookLink,
      blockType: 'join-in',
      title: 'Join In on Facebook',
      description: "See what we're up to and join in!",
      imageUrl: `${appEnv.staticAssetsBaseUrl}/images/to_facebook.png`,
      classEx: 'block-image-scale-down',
    },
    {
      link: 'join-in',
      blockType: 'join-in',
      title: 'Local Info',
      description: 'Report bags for collection, contact us, and much more!',
    },
    {
      link: 'knowledge/getting-started/safety',
      blockType: 'knowledge',
      title: 'Safety Info',
      description: '',
    },
  ];

  const right: WelcomeBlock[] = [
    {
      link: 'join-in/stats',
      blockType: 'join-in',
      title: '',
      description: '',
      imageUrl: statsImage,
      imageClass: 'stats-image',
      statsUniqueId: network.uniqueId ?? 'all',
    },
    {
      link: 'join-in/resources',
      blockType: 'join-in',
      title: 'Resources',
      description: 'Some handy publicity materials!',
    },
    {
      link: 'news',
      blockType: 'news',
      title: 'News',
      description: 'Read all about it!'
    },
  ];

  return [left, right];
}

/**
 * Interleave column arrays so responsive layouts can stack blocks left-right-left order.
 */
function interleaveColumns(columns: WelcomeBlock[][]) {
  if (!columns.length) {
    return [];
  }

  const maxLength = Math.max(...columns.map((column) => column.length));
  const result: WelcomeBlock[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    columns.forEach((column) => {
      const block = column[index];
      if (block) {
        result.push(block);
      }
    });
  }

  return result;
}
