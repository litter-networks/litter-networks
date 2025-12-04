// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export interface DistrictCsvRow {
  mapStyle?: string;
  councilName?: string;
  councilUrl?: string;
  uniqueId: string;
  region?: string;
  fullName?: string;
  country?: string;
}

export async function fetchDistrictsCsv(signal?: AbortSignal): Promise<DistrictCsvRow[]> {
  try {
    const response = await fetch('/api/info/get-districts-csv', { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch districts CSV: ${response.status}`);
    }
    const text = await response.text();
    return parseCsv(text);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return [];
    }
    console.error('fetchDistrictsCsv error', error);
    return [];
  }
}

function parseCsv(csv: string): DistrictCsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]
    .replace(/^"|"$/g, '')
    .split('","')
    .map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cols = line
      .replace(/^"|"$/g, '')
      .split('","')
      .map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? '';
    });
    return {
      mapStyle: row.mapStyle,
      councilName: row.councilName,
      councilUrl: row.councilUrl,
      uniqueId: row.uniqueId,
      region: row.region,
      fullName: row.fullName,
      country: row.country,
    };
  });
}
