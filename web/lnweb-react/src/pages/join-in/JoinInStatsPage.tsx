import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatsBoardImage } from '@/components/stats/StatsBoardImage';
import { fetchStatsSummary, type StatsSummary } from '@/data-sources/stats';
import { useNavData } from '@/features/nav/NavDataContext';
import { StatsSummaryImage } from '@/components/stats/StatsSummaryImage';
import { usePageTitle } from '@/shared/usePageTitle';
import styles from './styles/join-in-stats.module.css';

interface BoardTarget {
  id: string;
  uniqueId: string;
  caption: string;
}

export function JoinInStatsPage() {
  const { network, buildPath } = useNavData();
  const { formal } = useParams<{ formal?: string }>();
  const isFormal = formal === 'formal';
  usePageTitle('Join In | Stats');

  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingSummary(true);
        setSummaryError(null);
        const data = await fetchStatsSummary(network?.uniqueId);
        if (!cancelled) {
          setSummary(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load stats summary', error);
          setSummaryError('Unable to load stats summary right now.');
        }
      } finally {
        if (!cancelled) {
          setLoadingSummary(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [network?.uniqueId]);

  const boardTargets = useMemo<BoardTarget[]>(() => {
    const targets: BoardTarget[] = [];
    if (network?.uniqueId) {
      targets.push({
        id: 'network',
        uniqueId: network.uniqueId,
        caption: `${network.fullName ?? network.uniqueId} Litter Network`,
      });
    }
    if (network?.districtId) {
      targets.push({
        id: 'district',
        uniqueId: network.districtId,
        caption: `${network.districtFullName ?? 'Local'} Area`,
      });
    }
    targets.push({
      id: 'all',
      uniqueId: 'all',
      caption: 'Litter Networks in All Areas',
    });
    return targets;
  }, [network?.uniqueId, network?.fullName, network?.districtId, network?.districtFullName]);

  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
    if (boardTargets.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % boardTargets.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [boardTargets.length]);

  const togglePath = isFormal ? buildPath('join-in/stats') : buildPath('join-in/stats/formal');

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>
          Join In | <b>Stats</b>
        </h1>
        <Link to={togglePath} className={styles.toggleButton}>
          Style: {isFormal ? 'Formal' : 'Casual'}
        </Link>
      </div>
      <div className={styles.content}>
        <div className={styles.boardColumn}>
          <div className={styles.rotator}>
            {boardTargets.map((target, index) => (
              <div
                key={target.id}
                className={`${styles.boardWrapper} ${
                  index === activeIndex ? styles.boardWrapperActive : ''
                }`}
              >
                <StatsBoardImage
                  uniqueId={target.uniqueId}
                  variant={isFormal ? 'formal' : 'casual'}
                  className={styles.statsImage}
                  alt={target.caption}
                />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.summaryColumn}>
          <div className={styles.summaryCard}>
            {loadingSummary && <p>Loading stats summary…</p>}
            {!loadingSummary && summary && (
              <div className={styles.summaryImageWrapper}>
                <StatsSummaryImage
                  summary={summary}
                  networkName={network?.fullName}
                  districtName={summary.districtName}
                  className={styles.summaryImage}
                />
                <p className={styles.srOnly}>
                  {buildSummaryText(summary, network?.fullName, summary.districtName)}
                </p>
              </div>
            )}
            {summaryError && <p className={styles.errorText}>{summaryError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSummaryText(summary: Awaited<ReturnType<typeof fetchStatsSummary>>, networkName?: string, districtName?: string) {
  const formatNumber = (value?: number | null) => {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return '0';
  };

  const parts: string[] = [];
  if (networkName && typeof summary.memberCountNetwork === 'number') {
    parts.push(`${networkName} Litter Network has ${formatNumber(summary.memberCountNetwork)} members.`);
    if (summary.numNetworksInDistrict > 0) {
      parts.push(
        `It is one of ${formatNumber(summary.numNetworksInDistrict)} Litter Networks in the ${districtName || 'local'} area, with a total of ${formatNumber(summary.memberCountDistrict)} members.`,
      );
    }
  }

  parts.push(
    `There are ${formatNumber(summary.numNetworksInAll)} Litter Networks across the UK, with a total of ${formatNumber(summary.memberCountAll)} members.`,
  );
  return parts.join(' ');
}
