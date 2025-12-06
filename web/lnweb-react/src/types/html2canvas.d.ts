// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

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
