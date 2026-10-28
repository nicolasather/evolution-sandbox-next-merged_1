'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;
/**
 * False during SSR and the first hydration render, true afterwards. Gate every localStorage / sessionStorage read behind it
 * (and render a skeleton while false) so server HTML and first client HTML always match.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
