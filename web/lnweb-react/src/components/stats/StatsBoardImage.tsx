// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

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

/**
 * Renders a generated statistics board image for a given identifier.
 *
 * While generating the image it displays an optional placeholder and sets `aria-busy` on the rendered `<img>`.
 *
 * @param uniqueId - Identifier used to fetch bags information for rendering the stats board
 * @param placeholderSrc - Optional image URL used while the stats board is being generated
 * @param variant - Visual variant of the board; use `'formal'` to render the formal art, otherwise the casual art is used
 * @returns A fragment containing a hidden `<canvas>` used for rendering and an `<img>` that displays the generated stats board (or the placeholder while loading)
 */
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
    setImageSrc(placeholderSrc ?? baseImageSrc);
  }, [placeholderSrc, uniqueId, variant, baseImageSrc]);

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

/**
 * Load an image from a URL with cross-origin anonymous enabled.
 *
 * @param src - The image source URL
 * @returns The loaded HTMLImageElement, or a rejected promise with the load error event
 */
function loadBaseImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = src;
  });
}
