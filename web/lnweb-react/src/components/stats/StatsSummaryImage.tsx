import type { JSX } from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import type { StatsSummary } from '@/data-sources/stats';
import { loadHtml2Canvas } from '@/shared/loadHtml2Canvas';
import boardStyles from './styles/join-in-summary-board.module.css';

interface StatsSummaryImageProps {
  summary: StatsSummary;
  networkName?: string;
  districtName?: string;
  className?: string;
}

export function StatsSummaryImage({ summary, networkName, districtName, className }: StatsSummaryImageProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImageSrc(null);

    async function renderBoard() {
      if (!boardRef.current) {
        return;
      }
      try {
        await loadHtml2Canvas();
        if (!window.html2canvas || cancelled) {
          return;
        }
        const canvas = await window.html2canvas(boardRef.current, {
          backgroundColor: null,
          scale: window.devicePixelRatio && window.devicePixelRatio > 1 ? 2 : 1,
        });
        if (!cancelled) {
          setImageSrc(canvas.toDataURL('image/png'));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to render stats summary', error);
        }
      }
    }

    renderBoard();
    return () => {
      cancelled = true;
    };
  }, [summary, networkName, districtName]);

  return (
    <>
      <div className={boardStyles.offscreen} aria-hidden>
        <SummaryBoardContent ref={boardRef} summary={summary} networkName={networkName} districtName={districtName} />
      </div>
      {imageSrc ? (
        <img src={imageSrc} alt="Network membership summary" className={className} />
      ) : (
        <div className={`${boardStyles.placeholder} ${className ?? ''}`.trim()}>Preparing summary…</div>
      )}
    </>
  );
}

const SummaryBoardContent = forwardRef<HTMLDivElement, SummaryContentProps>(function SummaryBoardContent(
  { summary, networkName, districtName },
  ref,
) {
  const paragraphs: JSX.Element[] = [];
  const formatNumber = (value?: number | null) => {
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return '0';
  };

  if (networkName && typeof summary.memberCountNetwork === 'number') {
    paragraphs.push(
      <p key="network">
        <span className={boardStyles.statName}>{networkName} Litter Network</span> has{' '}
        <span className={boardStyles.statXXXL}>{formatNumber(summary.memberCountNetwork)}</span> members!
      </p>,
    );

    if (summary.numNetworksInDistrict > 0) {
      paragraphs.push(
        <p key="district">
          It is one of <span className={boardStyles.statXL}>{formatNumber(summary.numNetworksInDistrict)}</span> Litter Networks
          in the <span className={boardStyles.statName}>{districtName || 'local'}</span> area, with a total of{' '}
          <span className={boardStyles.statXXL}>{formatNumber(summary.memberCountDistrict)}</span> members!
        </p>,
      );
    }
  }

  paragraphs.push(
    <p key="all">
      There are <span className={boardStyles.statXL}>{formatNumber(summary.numNetworksInAll)}</span> Litter Networks across{' '}
      <span className={boardStyles.statName}>the UK</span>, with a total of{' '}
      <span className={boardStyles.statXXXL}>{formatNumber(summary.memberCountAll)}</span> members!
    </p>,
  );

  return (
    <div className={boardStyles.board} ref={ref}>
      <div className={boardStyles.boardBox}>
        <div className={boardStyles.boardText}>{paragraphs}</div>
      </div>
    </div>
  );
});

interface SummaryContentProps {
  summary: StatsSummary;
  networkName?: string;
  districtName?: string;
}
