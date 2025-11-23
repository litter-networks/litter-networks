import { useEffect, useRef, useState } from 'react';
import { appEnv } from '@/config/env';
import { fetchBagsInfo } from '@/data-sources/stats';
import { renderStatsBoard } from './renderStatsBoard';

interface StatsBoardImageProps {
  uniqueId: string;
  className?: string;
  alt?: string;
  placeholderSrc?: string;
  variant?: 'casual' | 'formal';
}

export function StatsBoardImage({
  uniqueId,
  className,
  alt = '',
  placeholderSrc,
  variant = 'casual',
}: StatsBoardImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | undefined>(placeholderSrc);
  const [loading, setLoading] = useState(true);
  const baseImageSrc =
    variant === 'formal'
      ? `${appEnv.staticAssetsBaseUrl}/images/stats-board-formal.png`
      : `${appEnv.staticAssetsBaseUrl}/images/stats-board.png`;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const [bagsInfo, baseImage] = await Promise.all([
          fetchBagsInfo(uniqueId, controller.signal),
          loadBaseImage(baseImageSrc),
        ]);
        if (!canvasRef.current) {
          return;
        }

        const dataUrl = await renderStatsBoard(canvasRef.current, baseImage, bagsInfo, {
          formal: variant === 'formal',
        });
        if (!cancelled) {
          setImageSrc(dataUrl);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to render stats board', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [uniqueId, variant, baseImageSrc]);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} width={1542} height={1060} />
      <img src={imageSrc} alt={alt} className={className} aria-busy={loading} />
    </>
  );
}

function loadBaseImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = src;
  });
}
