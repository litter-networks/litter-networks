// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import type { BagsInfo } from '@/data-sources/stats';

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
}

const COLORS = {
  text: 'rgb(0, 0, 0)',
  textScaled: 'rgb(23, 20, 99)',
  header: 'rgb(80, 124, 58)',
  formalText: 'rgb(255, 255, 255)',
  dateTime: 'rgb(60, 60, 60)',
};

const FONT_SIZES = {
  networkName: 64,
  other: 40,
  dateTime: 16,
};

const SCALE = {
  factor: 1,
  offsetX: 10,
};

/**
 * Normalize a numeric or numeric-string bag count into a plain number.
 *
 * @param value - A number or a string (commas allowed) representing a count; may be undefined.
 * @returns The parsed numeric value, or `0` if `value` is undefined or cannot be parsed as a number.
 */
function parseCount(value?: number | string) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function computeBagCountScale(text: string, allowScale: boolean) {
  if (!allowScale) {
    return 1;
  }

  const digitsOnly = text.replace(/\D/g, '');
  const digitLength = digitsOnly.length || text.length;
  // Treat five-digit values like four-digit ones so the large jump only occurs once counts exceed 99,999.
  const effectiveLength = digitLength <= 4 ? digitLength : digitLength === 5 ? 4 : digitLength;

  if (effectiveLength <= 0) {
    return 1;
  }

  return Math.min(1, 3.2 / effectiveLength);
}

/**
 * Render a centered statistic line consisting of a leading label, a numeric count, and trailing text onto the provided canvas context.
 *
 * Parses and formats the count (adds thousands separators for values >= 10,000) and optionally scales the count's font to fit the available space. Positions the combined text centered horizontally at the specified vertical position and applies colors and scale from `options`.
 *
 * @param ctx - Drawing context and canvas used for rendering
 * @param lineY - Vertical position (unscaled) where the line should be drawn
 * @param preText - Text preceding the numeric count
 * @param bagCountValue - Numeric count or string representation to display; non-numeric values are treated as zero
 * @param postText - Text following the numeric count
 * @param allowScale - When true, the numeric count's font may be reduced to keep it visually compact
 * @param bagCountSize - Base font size to use for the numeric count before applying scaling
 * @param options.scaleFactor - Global scale multiplier applied to positions and font sizes
 * @param options.textColor - Color used for non-scaled text elements
 * @param options.textColorScaled - Color used for text when `allowScale` is true
 */
function drawStatsLine(
  { ctx, canvas }: DrawContext,
  lineY: number,
  preText: string,
  bagCountValue: number | string,
  postText: string,
  allowScale: boolean,
  bagCountSize: number,
  options: { scaleFactor: number; textColor: string; textColorScaled: string },
) {
  const bagCount = parseCount(bagCountValue);
  const lineYScaled = lineY * options.scaleFactor;
  const bagCountText = bagCount >= 100000 ? bagCount.toLocaleString() : bagCount.toString();
  const scale = computeBagCountScale(bagCountText, allowScale);
  const bagCountFontSize = bagCountSize * scale;

  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';

  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const preWidth = ctx.measureText(preText).width;

  ctx.font = `bold ${bagCountFontSize * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const countWidth = ctx.measureText(bagCountText).width;

  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const postWidth = ctx.measureText(postText).width;

  const totalWidth = preWidth + countWidth + postWidth;
  const startX = SCALE.offsetX + canvas.width / 2 - totalWidth / 2;

  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillStyle = allowScale ? options.textColorScaled : options.textColor;
  ctx.fillText(preText, startX, lineYScaled);

  const adjustment = (FONT_SIZES.other - bagCountFontSize) * -0.29 * options.scaleFactor;
  ctx.font = `bold ${bagCountFontSize * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillText(bagCountText, startX + preWidth, lineYScaled + adjustment);

  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillText(postText, startX + preWidth + countWidth, lineYScaled);
}

/**
 * Render a centered composite statistic line containing a leading label, two numeric counts with intervening text segments, and a trailing label.
 *
 * The function formats large counts with thousands separators, optionally scales the primary count to fit, renders the second count at a reduced size, and applies a subdued color for the intermediate text when `isFormal` is true.
 *
 * @param ctx - Drawing context and canvas used for rendering
 * @param lineY - Vertical position (unscaled) for the line baseline
 * @param preText - Text displayed before the first count
 * @param bagCountValue - First numeric count (number or numeric string)
 * @param mid1Text - Text displayed between the first count and the secondary mid text
 * @param mid2Text - Secondary mid text displayed before the second count
 * @param bagCount2Value - Second numeric count (number or numeric string)
 * @param postText - Text displayed after the second count
 * @param allowScale - Whether the primary count may be scaled down to fit
 * @param bagCountSize - Base font size for the primary count (before scaling)
 * @param options.scaleFactor - Global scale factor applied to all layout and fonts
 * @param options.textColor - Primary text color used for labels and main count
 * @param options.isFormal - If true, applies a subdued color/opacity to the secondary mid text for a formal appearance
 */
function drawStatsDoubleLine(
  { ctx, canvas }: DrawContext,
  lineY: number,
  preText: string,
  bagCountValue: number | string,
  mid1Text: string,
  mid2Text: string,
  bagCount2Value: number | string,
  postText: string,
  allowScale: boolean,
  bagCountSize: number,
  options: { scaleFactor: number; textColor: string; isFormal: boolean },
) {
  const bagCount = parseCount(bagCountValue);
  const bagCount2 = parseCount(bagCount2Value);
  const lineYScaled = lineY * options.scaleFactor;
  const bagCountText = bagCount >= 100000 ? bagCount.toLocaleString() : bagCount.toString();
  const bagCount2Text = bagCount2 >= 100000 ? bagCount2.toLocaleString() : bagCount2.toString();

  const scale = computeBagCountScale(bagCountText, allowScale);
  const bagCountFontSize = bagCountSize * scale;
  const secondStatScale = 0.8;
  const bagCount2FontSize = bagCountFontSize * secondStatScale;

  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';

  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const preWidth = ctx.measureText(preText).width;
  ctx.font = `bold ${bagCountFontSize * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const countWidth = ctx.measureText(bagCountText).width;
  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const mid1Width = ctx.measureText(mid1Text).width;
  ctx.font = `${FONT_SIZES.other * secondStatScale * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const mid2Width = ctx.measureText(mid2Text).width;
  ctx.font = `bold ${bagCount2FontSize * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const count2Width = ctx.measureText(bagCount2Text).width;
  ctx.font = `${FONT_SIZES.other * secondStatScale * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  const postWidth = ctx.measureText(postText).width;

  const totalWidth = preWidth + countWidth + mid1Width + mid2Width + count2Width + postWidth;
  const startX = SCALE.offsetX + canvas.width / 2 - totalWidth / 2;
  const adjustmentY = 2;

  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillStyle = options.textColor;
  ctx.fillText(preText, startX, lineYScaled + adjustmentY);

  ctx.font = `bold ${bagCountFontSize * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillText(bagCountText, startX + preWidth, lineYScaled + adjustmentY);

  ctx.font = `${FONT_SIZES.other * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillText(mid1Text, startX + preWidth + countWidth, lineYScaled + adjustmentY);

  ctx.font = `${FONT_SIZES.other * secondStatScale * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillStyle = options.isFormal ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.75)';
  ctx.fillText(mid2Text, startX + preWidth + countWidth + mid1Width, lineYScaled);

  ctx.font = `bold ${bagCount2FontSize * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillText(bagCount2Text, startX + preWidth + countWidth + mid1Width + mid2Width, lineYScaled);

  ctx.font = `${FONT_SIZES.other * secondStatScale * options.scaleFactor}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillText(postText, startX + preWidth + countWidth + mid1Width + mid2Width + count2Width, lineYScaled);
}

/**
 * Render a statistics board onto the provided canvas using the supplied base image and BagsInfo.
 *
 * Renders title lines, multiple statistic lines (month/year/lifetime totals), and an optional date line,
 * applying a formal visual style when requested or when the base image indicates it.
 *
 * @param canvas - The HTMLCanvasElement to draw onto; its size will be set to match `baseImage`.
 * @param baseImage - The background image used for the board layout.
 * @param info - BagsInfo containing network/district metadata and bag count values for rendering.
 * @param options - Optional rendering options.
 * @param options.formal - When true (or when `baseImage.src` contains "formal"), use the formal visual style.
 * @returns A PNG data URL representing the rendered canvas image.
 * @throws Error if a 2D drawing context cannot be obtained from `canvas`.
 */
export async function renderStatsBoard(
  canvas: HTMLCanvasElement,
  baseImage: HTMLImageElement,
  info: BagsInfo,
  options?: { formal?: boolean },
): Promise<string> {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to get canvas context');
  }

  const isFormal = Boolean(options?.formal || baseImage.src.includes('formal'));
  const scaleFactor = isFormal ? 1.45 : 1;
  const textColor = isFormal ? COLORS.formalText : COLORS.text;
  const textColorScaled = isFormal ? COLORS.formalText : COLORS.textScaled;
  const headerColor = isFormal ? COLORS.formalText : COLORS.header;

  canvas.width = baseImage.width;
  canvas.height = baseImage.height;
  ctx.drawImage(baseImage, 0, 0);

  const offsetAllY = isFormal ? -35 : 45;
  const titleLines = info.isAll
    ? ['Litter Networks in', 'All Areas']
    : info.isDistrict
      ? ['Litter Networks in', info.districtName ?? '']
      : [info.networkName ?? '', 'Litter Network'];

  ctx.fillStyle = headerColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `${FONT_SIZES.networkName}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;

  let titleY = 80 + offsetAllY;
  for (const line of titleLines) {
    const lineX = SCALE.offsetX + canvas.width / 2;
    ctx.fillText(line, lineX, titleY);
    titleY += FONT_SIZES.networkName;
  }

  const bagCounts = info.bagCounts ?? ({} as BagsInfo['bagCounts']);
  const drawCtx: DrawContext = { ctx, canvas };

  drawStatsDoubleLine(
    drawCtx,
    270 + offsetAllY,
    `${bagCounts.thisMonthName ?? 'This Month'} total `,
    bagCounts.thisMonth ?? 0,
    ' bags',
    ` | ${(bagCounts.lastMonthName ?? 'Last Month')} total `,
    bagCounts.lastMonth ?? 0,
    ' bags',
    false,
    42,
    { scaleFactor, textColor, isFormal },
  );

  drawStatsLine(
    drawCtx,
    500 + offsetAllY,
    `${bagCounts.thisYearName ?? 'This Year'} total `,
    bagCounts.thisYear ?? 0,
    ' bags',
    true,
    260,
    { scaleFactor, textColor, textColorScaled },
  );

  drawStatsLine(
    drawCtx,
    620 + offsetAllY,
    `${bagCounts.lastYearName ?? 'Last Year'} total `,
    bagCounts.lastYear ?? 0,
    ' bags',
    false,
    70,
    { scaleFactor, textColor, textColorScaled },
  );

  drawStatsLine(
    drawCtx,
    690 + offsetAllY,
    'Lifetime total ',
    bagCounts.allTime ?? 0,
    ' bags',
    false,
    52,
    { scaleFactor, textColor, textColorScaled },
  );

  const infoY = isFormal ? 1025 : 842;
  const dateText = bagCounts.mostRecentPost ? `as of ${bagCounts.mostRecentPost}` : '';
  ctx.font = `${FONT_SIZES.dateTime}px 'Calibri', 'Arial', 'Helvetica', sans-serif`;
  ctx.fillStyle = COLORS.dateTime;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(dateText, SCALE.offsetX + canvas.width / 2, infoY);

  return canvas.toDataURL('image/png');
}
