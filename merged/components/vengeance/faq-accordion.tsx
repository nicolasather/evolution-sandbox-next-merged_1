"use client";

/* Vengeance UI — faq-accordion (registry:ui), adapted.
   Source: https://github.com/Ashutoshx7/VengeanceUI  public/r/faq-accordion.json
   Commit 813d9c1 (2026-08-31). MIT licence — see ./LICENSE.

   Same structure and behaviour as upstream (one item open at a time, a +/−
   marker, a grid-rows height transition). Changes, all local to this copy:
   - colours come from this project's tokens instead of Tailwind's neutral
     scale with `dark:` variants (this site is dark whatever the OS says);
   - square corners, 2px rules, a mono catalogue number before each question,
     a small +/− marker instead of the large glyph, and no chevron — to match
     the museum-plate styling;
   - accessibility: each question controls a labelled region, and a closed
     answer is `inert`, so it is neither read aloud nor tabbable;
   - no demo items or demo title; `defaultOpen` picks the first open item. */

import React, { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

export interface FaqAccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  items: FaqItem[];
  title?: string;
  /** Index of the item open on first render; null for all closed. */
  defaultOpen?: number | null;
}

export function FaqAccordion({
  items,
  title,
  defaultOpen = null,
  className,
  ...props
}: FaqAccordionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(defaultOpen);
  const uid = useId();

  const toggleItem = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className={cn("relative w-full", className)} {...props}>
      {title && (
        <h2 className="mb-8 font-display text-2xl font-normal text-bone-2">
          {title}
        </h2>
      )}

      <ul className="m-0 flex w-full list-none flex-col p-0">
        {items.map((item, index) => {
          const isActive = activeIndex === index;
          const qId = `${uid}-q-${index}`;
          const aId = `${uid}-a-${index}`;
          return (
            <li
              key={index}
              className="relative w-full border-b border-line transition-colors duration-300 ease-in last:border-b-0"
            >
              <h2 className="m-0">
                <button
                  id={qId}
                  type="button"
                  aria-expanded={isActive}
                  aria-controls={aId}
                  onClick={() => toggleItem(index)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-baseline gap-4 border-l-2 py-5 pr-10 pl-5 text-left",
                    "font-display text-[21px] leading-[1.25] font-normal tracking-[-0.01em] transition-colors duration-200",
                    isActive
                      ? "border-l-ochre bg-ochre-lo text-bone"
                      : "border-l-line-2 bg-transparent text-bone-2 hover:border-l-bone-3 hover:bg-ink-2 hover:text-bone"
                  )}
                >
                  <span className="mono flex-none text-[11px] text-ochre">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-1/2 right-4 -translate-y-1/2 font-mono text-base leading-none transition-colors duration-200",
                      isActive ? "text-ochre" : "text-bone-4"
                    )}
                  >
                    {isActive ? "−" : "+"}
                  </span>
                </button>
              </h2>

              <div
                id={aId}
                role="region"
                aria-labelledby={qId}
                inert={!isActive}
                className={cn(
                  "grid w-full border-l-2 transition-all duration-300 ease-in-out",
                  isActive ? "grid-rows-[1fr] border-l-ochre bg-ochre-lo" : "grid-rows-[0fr] border-l-transparent"
                )}
              >
                <div className="overflow-hidden">
                  <div className="max-w-[66ch] pt-1 pr-6 pb-6 pl-[3.25rem] text-[14.5px] leading-[1.72] text-bone-2">
                    {item.answer}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default FaqAccordion;
