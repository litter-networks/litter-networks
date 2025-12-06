// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

export interface HTMLWebViewElement extends HTMLElement {
  src?: string;
  reload?: () => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement> & {
        src: string;
        allowpopups?: string | boolean;
      };
    }
  }
}

export {};
