export {};

declare global {
  interface Html2CanvasOptions {
    backgroundColor?: string | null;
    scale?: number;
  }

  interface Window {
    html2canvas?: (element: HTMLElement, options?: Html2CanvasOptions) => Promise<HTMLCanvasElement>;
  }
}
