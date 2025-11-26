const scriptPromises = new Map<string, Promise<void>>();
const loadedScripts = new Set<string>();
const cssPromises = new Map<string, Promise<void>>();
const loadedCss = new Set<string>();

/**
 * Ensures Leaflet and site map stylesheets are loaded, then loads the corresponding Leaflet and site map scripts.
 *
 * This operation is idempotent and safe to call multiple times: repeated or concurrent calls will not duplicate network requests. Errors from loading any asset propagate to the caller.
 */
export async function loadMapsAssets() {
  await Promise.all([
    ensureCss('https://cdn.litternetworks.org/3rd-party/leaflet/leaflet.css'),
    ensureCss(
      'https://cdn.litternetworks.org/css/maps.css',
      'sha384-zR6gXLggfih2rRvjpeSGoCPsqkFGPLPzxa58ww943ZomF9uVvTApN2tt0Is9tVgK',
      'anonymous',
    ),
  ]);
  await ensureScript('https://cdn.litternetworks.org/3rd-party/leaflet/leaflet.js');
  await ensureScript(
    'https://cdn.litternetworks.org/js/maps.js',
    'sha384-fkne35iYTpuzOuGDCawh1eVhyYggV0aufzqHM1OodyIsPbjWVwrBgSoPt6ZN5c/o',
    'anonymous',
  );
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

/**
 * Ensures the stylesheet at `href` is loaded into the document, reusing any in-flight or cached load to avoid duplicate requests.
 *
 * @param href - The stylesheet URL to load.
 * @param integrity - Optional Subresource Integrity hash to apply to the link element.
 * @param crossOrigin - Optional crossOrigin attribute value to apply to the link element (for example, `"anonymous"`).
 * @returns `void` when the stylesheet has been loaded.
 */
function ensureCss(href: string, integrity?: string, crossOrigin?: string) {
  if (loadedCss.has(href)) {
    return Promise.resolve();
  }
  if (cssPromises.has(href)) {
    return cssPromises.get(href)!;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    if (integrity) {
      link.integrity = integrity;
    }
    if (crossOrigin) {
      link.crossOrigin = crossOrigin;
    }
    link.href = href;
    link.onload = () => {
      loadedCss.add(href);
      cssPromises.delete(href);
      resolve();
    };
    link.onerror = () => {
      cssPromises.delete(href);
      reject(new Error(`Failed to load ${href}`));
    };
    document.head.appendChild(link);
  });
  cssPromises.set(href, promise);
  return promise;
}
