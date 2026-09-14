'use client';

import { AnimatedNumber } from './animated-number';
import { cn } from '@/lib/utils';

/**
 * The top-bar counter: Vengeance UI's AnimatedNumber (digit wheels that roll
 * to the new value), zero-padded so the counter keeps a fixed width — "007"
 * rolls to "008" instead of "7" growing into "10".
 *
 * Kept as its own tiny module so call sites do not care which animation
 * library sits underneath. Reduced motion is handled by the <MotionConfig>
 * around the sandbox.
 */
export function AnimatedCount({
  value,
  pad = 0,
  className,
}: {
  value: number;
  /** Zero-pad to this width, so the counter does not reflow as it grows. */
  pad?: number;
  className?: string;
}) {
  const text = pad ? String(value).padStart(pad, '0') : String(value);
  return (
    <span className={cn('num tabular-nums', className)} aria-label={String(value)}>
      <span aria-hidden="true"><AnimatedNumber value={text} /></span>
    </span>
  );
}
