const SCRIPT_URL = 'https://cdn.litternetworks.org/js/3rd-party/html2canvas.min.js';

let scriptPromise: Promise<void> | null = null;

export function loadHtml2Canvas() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.html2canvas) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Failed to load html2canvas'));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}
