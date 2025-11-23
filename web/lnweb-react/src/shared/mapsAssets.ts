const scriptPromises = new Map<string, Promise<void>>();
const loadedScripts = new Set<string>();
const cssPromises = new Map<string, Promise<void>>();
const loadedCss = new Set<string>();

export async function loadMapsAssets() {
  await Promise.all([
    ensureCss(
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
      'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H',
      'anonymous',
    ),
    ensureCss(
      'https://cdn.litternetworks.org/css/maps.css',
      'sha384-zR6gXLggfih2rRvjpeSGoCPsqkFGPLPzxa58ww943ZomF9uVvTApN2tt0Is9tVgK',
      'anonymous',
    ),
  ]);
  await ensureScript(
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH',
    'anonymous',
  );
  await ensureScript(
    'https://cdn.litternetworks.org/js/maps.js',
    'sha384-fkne35iYTpuzOuGDCawh1eVhyYggV0aufzqHM1OodyIsPbjWVwrBgSoPt6ZN5c/o',
    'anonymous',
  );
}

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
