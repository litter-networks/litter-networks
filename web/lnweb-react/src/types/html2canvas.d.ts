export {};

declare global {
  interface Html2CanvasOptions {
    backgroundColor?: string | null;
    scale?: number;
  }

  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2canvas?: (element: HTMLElement, options?: Html2CanvasOptions) => Promise<HTMLCanvasElement>;
  }
}
