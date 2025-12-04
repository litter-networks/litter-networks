// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

const scriptPromises = new Map<string, Promise<void>>();
const loadedScripts = new Set<string>();
let leafletAndMapScriptPromise: Promise<void> | null = null;

/**
 * Ensures Leaflet's global script loads before importing the internal map helpers.
 *
 * Loading is memoized so repeated calls resolve with the same promise.
 */
export async function loadMapsAssets() {
  if (!leafletAndMapScriptPromise) {
    leafletAndMapScriptPromise = ensureScript(
      'https://cdn.litternetworks.org/3rd-party/leaflet/leaflet.js',
    )
      .then(() => import('@/shared/maps/mapsScript'))
      .then(() => undefined);
  }
  await leafletAndMapScriptPromise;
}

/**
 * Loads a JavaScript file into the document and avoids duplicate concurrent loads for the same URL.
 *
 * @param src - The script URL to load.
 * @param integrity - Optional Subresource Integrity (SRI) string to set on the script element.
 * @param crossOrigin - Optional crossOrigin attribute value (e.g., "anonymous").
 * @returns A promise that resolves when the script is successfully loaded, or rejects if loading fails.
 */
function ensureScript(src: string, integrity?: string, crossOrigin?: string) {
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src)!;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    if (integrity) {
      script.integrity = integrity;
    }
    if (crossOrigin) {
      script.crossOrigin = crossOrigin;
    }
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      scriptPromises.delete(src);
      resolve();
    };
    script.onerror = () => {
      scriptPromises.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.body.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
}
