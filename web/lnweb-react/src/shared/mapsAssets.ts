const scriptPromises = new Map<string, Promise<void>>();
const loadedScripts = new Set<string>();
const cssPromises = new Map<string, Promise<void>>();
const loadedCss = new Set<string>();

export async function loadMapsAssets() {
  await Promise.all([
    ensureCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
    ensureCss('https://cdn.litternetworks.org/css/maps.css'),
  ]);
  await ensureScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  await ensureScript('https://cdn.litternetworks.org/js/maps.js');
}

function ensureScript(src: string) {
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src)!;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
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

function ensureCss(href: string) {
  if (loadedCss.has(href)) {
    return Promise.resolve();
  }
  if (cssPromises.has(href)) {
    return cssPromises.get(href)!;
  }
  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
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
