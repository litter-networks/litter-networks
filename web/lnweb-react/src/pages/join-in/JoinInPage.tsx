import { useEffect, useState, type ReactNode } from 'react';
import { useNavData } from '@/features/nav/NavDataContext';
import { fetchDistrictLocalInfo, type DistrictLocalInfo } from '@/data-sources/joinIn';
import { usePageTitle } from '@/shared/usePageTitle';
import styles from './styles/join-in.module.css';

interface InfoBlock {
  title: string;
  description: ReactNode;
  href: string;
  type: 'email' | 'external' | 'internal';
}

export function JoinInPage() {
  const { network } = useNavData();
  const [localInfo, setLocalInfo] = useState<DistrictLocalInfo | null>(null);
  const [loading, setLoading] = useState(false);
  usePageTitle('Join In');

  useEffect(() => {
    let cancelled = false;
    if (!network?.districtId) {
      setLocalInfo(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetchDistrictLocalInfo(network.districtId, controller.signal)
      .then((info) => {
        if (!cancelled) {
          setLocalInfo(info);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || cancelled) {
          return;
        }
        console.error('Failed to load district local info', error);
        setLocalInfo(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [network?.districtId]);

  const blocks = buildBlocks(localInfo);
  const titlePrefix = localInfo ? 'Local Info' : 'Reach Out';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Join In | <b>{titlePrefix}</b></h1>
      {!localInfo && !network && (
        <div className={styles.defaultNotice}>
          Choose your local network from the dropdown or map to see local disposal details, contacts, and more.
        </div>
      )}
      {loading && <div className={styles.defaultNotice}>Loading local information…</div>}
      <div className={styles.blocks}>
        {blocks.map((block) => (
          <a
            key={block.title}
            href={block.href}
            className={`${styles.block} ${linkTypeClass(block.type)}`}
            target={block.type === 'external' ? '_blank' : undefined}
            rel={block.type === 'external' ? 'noopener noreferrer' : undefined}
          >
            <div className={styles.iconStrip} aria-hidden="true" />
            <div className={styles.blockContent}>
              <strong>{block.title}</strong>
              <p>{block.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function linkTypeClass(type: InfoBlock['type']) {
  if (type === 'email') return styles.linkEmail;
  if (type === 'external') return styles.linkExternal;
  return styles.linkInternal;
}

function buildBlocks(info: DistrictLocalInfo | null): InfoBlock[] {
  if (!info) {
    return [
      {
        title: 'Choose a Network',
        description: (
          <>
            Click here or on the <b>map</b> menu-item to choose your local network from our map, or use the{' '}
            <b>drop-down</b> at the top of this page! You will then be able to view local info, resources, what everyone's
            up to, and much more!
          </>
        ),
        href: '/all/join-in/choose',
        type: 'internal',
      },
      {
        title: 'Contact Us',
        description: (
          <>
            Click here to email us!  We're always keen to hear your thoughts and ideas! If you wish to start a Litter
            Network in your local area, or if we can help in any way, just drop us a message! <b>We're here to help!</b>
          </>
        ),
        href: 'mailto:contact@litternetworks.org',
        type: 'email',
      },
    ];
  }

  const blocks: InfoBlock[] = [
    {
      title: 'Bag Disposal',
      description: (
        <>
          Small amounts of litter can go in your bin{info.disposeSmallInBins === '1' ? ', or public litter bins' : ''}.
          For larger collections, leave the bags by a public litter bin and email the council to let them know the number
          of bags and location(s). You can click this block to do so.
          {' '}
          Use a <b>{info.councilBagsDescription ?? 'council'}</b> bag
          {info.councilTakesKBTBags === '1' ? ' or a Keep Britain Tidy bag' : ''} to indicate it's not fly-tipping. Many thanks!
        </>
      ),
      href: `mailto:${info.disposeEmail ?? 'contact@litternetworks.org'}`,
      type: 'email',
    },
    {
      title: 'Report Fly-Tipping',
      description: "Click to visit the council's website reporting fly-tipping! Reporting helps the council take action. It may take a few weeks, but it makes a difference.",
      href: info.flyTipReportUrl ?? 'https://www.gov.uk/report-flytipping',
      type: 'external',
    },
    {
      title: 'Report Asda Trolleys (Collex)',
      description: 'Collex handles Asda\'s trolleys. Also has an app for reporting.',
      href: 'https://tmsuk.org/collex/',
      type: 'external',
    },
    {
      title: 'Report Other Trolleys (TrolleyWise)',
      description: 'Click to visit the Trolleywise website, where you can download the app, or report directly with a photo and location!',
      href: 'https://www.wanzl.com/en_GB/360-degree-service/TrolleyWise/',
      type: 'external',
    },
  ];

  const scrapMerchants = Array.isArray(info.localScrapMetalUrls)
    ? info.localScrapMetalUrls
    : typeof info.localScrapMetalUrls === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(info.localScrapMetalUrls);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  scrapMerchants.forEach((item) => {
    if (item?.name && item?.url) {
      blocks.push({
        title: `Scrap Metal: ${item.name}`,
        description: 'Click to visit the website of this scrap-metal merchant recommended by local residents! Many metal merchants collect household or fly-tipped scrap (some may charge for fridges).',
        href: item.url,
        type: 'external',
      });
    }
  });

  if (info.localRecyclingUrl) {
    blocks.push({
      title: 'Recycling Centres',
      description: "Click to visit the council's website detailing local recycling centres. Useful for bulky domestic waste. Sites vary - check which items are accepted before visiting.",
      href: info.localRecyclingUrl,
      type: 'external',
    });
  }

  blocks.push({
    title: 'Contact Us',
    description: "Click here to email us!  We're always keen to hear about any info that we could improve, if you wish to start a Litter Network in your local area, or any other reason!",
    href: 'mailto:contact@litternetworks.org',
    type: 'email',
  });

  return blocks;
}
