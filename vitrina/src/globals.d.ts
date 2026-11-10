import type * as ReactNS from 'react';
import type * as ReactDOMClient from 'react-dom/client';

declare global {
  const React: typeof ReactNS;
  const ReactDOM: typeof ReactDOMClient;
}
export {};
