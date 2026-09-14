/* Vengeance UI's documented utility — see https://www.vengenceui.com/docs/add-utilities */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
