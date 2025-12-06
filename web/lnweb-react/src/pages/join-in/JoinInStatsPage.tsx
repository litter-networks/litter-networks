// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatsBoardImage } from '@/components/stats/StatsBoardImage';
import { fetchStatsSummary, type StatsSummary } from '@/data-sources/stats';
import { useNavData } from '@/features/nav/useNavData';
import { StatsSummaryImage } from '@/components/stats/StatsSummaryImage';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import { getPrimaryDistrictId } from '@/shared/utils/districtIds';
import { appEnv } from '@/config/env';
import { getStoredStatsStyle, setStoredStatsStyle, type StatsStylePreference } from '@/shared/statsStylePreference';
import styles from './styles/join-in-stats.module.css';

interface BoardTarget {
  id: string;
  uniqueId: string;
  caption: string;
}

/**
 * Render the Join In | Stats page with a rotator of stats boards, a summary panel, and a style toggle.
 *
 * Fetches and displays a stats summary for the current navigation network, showing loading and error
 * states as appropriate and cycling through available board targets when multiple targets exist.
 *
 * @returns The page's root JSX element
 */
export function JoinInStatsPage() {
  const { network, buildPath } = useNavData();
  const navigate = useNavigate();
  const { formal } = useParams<{ formal?: string }>();
  const [storedStyle, setStoredStyle] = useState<StatsStylePreference>(() => getStoredStatsStyle());
  const isFormal = formal === 'formal' || (!formal && storedStyle === 'formal');
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
    const districtUniqueId = getPrimaryDistrictId(network?.districtId);
    const targets: BoardTarget[] = [];
    if (network?.uniqueId) {
      targets.push({
        id: 'network',
        uniqueId: network.uniqueId,
        caption: `${network.fullName ?? network.uniqueId} Litter Network`,
      });
    }
    if (districtUniqueId) {
      targets.push({
        id: 'district',
        uniqueId: districtUniqueId,
        caption: `${network?.districtFullName ?? 'Local'} Area`,
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
  const [exitingIndex, setExitingIndex] = useState<number | null>(null);
  const previousActiveRef = useRef(0);

  useEffect(() => {
    setExitingIndex(null);
    setActiveIndex(0);
  }, [network?.uniqueId, isFormal]);

  useEffect(() => {
    setExitingIndex(null);
    setActiveIndex(0);
    if (boardTargets.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        setExitingIndex(current);
        return (current + 1) % boardTargets.length;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [boardTargets.length]);

  useEffect(() => {
    const lastActive = previousActiveRef.current;
    if (activeIndex === lastActive) {
      return;
    }
    setExitingIndex(lastActive);
    previousActiveRef.current = activeIndex;
    const timeout = window.setTimeout(() => {
      setExitingIndex((prev) => (prev === lastActive ? null : prev));
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [activeIndex]);

  useEffect(() => {
    if (formal === 'formal') {
      setStoredStyle('formal');
      setStoredStatsStyle('formal');
    }
  }, [formal]);

  const statsPlaceholderSrc = isFormal
    ? `${appEnv.staticAssetsBaseUrl}/images/stats-board-formal.png`
    : `${appEnv.staticAssetsBaseUrl}/images/stats-board.png`;
  const summaryPending = !summaryError && (!summary || loadingSummary);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>
          Join In | <b>Stats</b>
        </h1>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => {
            const nextStyle: StatsStylePreference = isFormal ? 'casual' : 'formal';
            setStoredStyle(nextStyle);
            setStoredStatsStyle(nextStyle);
            const target = nextStyle === 'formal' ? buildPath('join-in/stats/formal') : buildPath('join-in/stats');
            navigate(target);
          }}
        >
          Style: {isFormal ? 'Formal' : 'Casual'}
        </button>
      </div>
      <div className={styles.content}>
        <div className={styles.displayPanel}>
          <div className={styles.displayFrame}>
            {boardTargets.map((target, index) => {
              const isActive = index === activeIndex;
              const isExiting = index === exitingIndex;
              const classNames = [
                styles.boardWrapper,
                isActive || isExiting ? styles.boardWrapperActive : '',
                isExiting ? styles.boardWrapperExiting : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={target.id} className={classNames}>
                  <StatsBoardImage
                    uniqueId={target.uniqueId}
                    variant={isFormal ? 'formal' : 'casual'}
                    className={styles.statsImage}
                    placeholderSrc={statsPlaceholderSrc}
                    alt={target.caption}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.displayPanel}>
          <div className={`${styles.displayFrame} ${summaryPending ? styles.summaryCardPending : ''}`}>
            {summaryPending && <div className={styles.summaryPlaceholder} aria-busy={loadingSummary} />}
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

/**
 * Builds a concise, human-readable summary string describing network, district, and national statistics.
 *
 * When a `networkName` is provided and `summary.memberCountNetwork` is a number, includes a sentence about that network
 * and, if applicable, a sentence about its district. Always includes a sentence summarizing totals across the UK.
 *
 * @param summary - The fetched statistics used to compose the text (member counts and network totals).
 * @param networkName - Optional name of the network to mention in the summary.
 * @param districtName - Optional name of the district to mention when describing district-level totals; falls back to "local" if omitted.
 * @returns A single string containing one or more sentences describing the provided statistics.
 */
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
