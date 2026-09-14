"use client"

/* Vengeance UI — animated-number (registry:ui), adapted.
   Source: https://github.com/Ashutoshx7/VengeanceUI  public/r/animated-number.json
   Commit 813d9c1 (2026-08-31). MIT licence — see ./LICENSE.

   Changes from upstream, all local to this copy:
   - `value` also accepts a string, so a zero-padded counter ("007") keeps a
     fixed number of digit wheels instead of reflowing as it grows;
   - the unused `AnimatedScore` export (hard-coded green/red colours, `any`
     types) is left out;
   - named React imports only.
   Motion respects prefers-reduced-motion through the <MotionConfig
   reducedMotion="user"> that wraps the sandbox. */

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

function AnimatedNumber({ value, className }: { value: number | string, className?: string }) {
    return (
        <div className={cn("flex items-center", className)}>
            <div className="flex relative items-center">
                {String(value).split("").map((digit, index) => (
                    <SingleNumberHolder key={index} value={digit} index={index} />
                ))}
            </div>
        </div>
    )
}

function SingleNumberHolder({ value, index }: { value: string, index: number }) {
    const [height, setHeight] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    let notANumber = false

    useEffect(() => {
        if (containerRef.current) {
            setHeight(getComputedStyle(containerRef.current).height)
        }
    }, [])

    if (index === 0) {
        notANumber = isNaN(Number.parseInt(value))
    }

    const vars = {
        init: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    }

    return (
        <div
            className="relative"
            style={{ height: height || "auto", overflowY: "hidden", overflowX: "clip" }}
            ref={containerRef}
        >
            {notANumber && (
                <motion.span
                    initial="init"
                    animate="animate"
                    exit="exit"
                    variants={vars}
                    key={value}
                    layout="size"
                >
                    {value}
                </motion.span>
            )}
            {!notANumber && <RenderStrip value={value} eleHeight={height} />}
        </div>
    )
}

const zeroToNine = Array.from({ length: 10 }, (_, k) => k)

function RenderStrip({ eleHeight, value }: { eleHeight: string | null, value: string }) {
    const heightInNumber = Number.parseInt(eleHeight?.replace("px", "") || "48")
    const negative = heightInNumber * -1
    const pos = heightInNumber
    const prev = useRef(value)

    // Convert string values to numbers for comparison
    const currentVal = parseInt(value)
    const prevVal = parseInt(prev.current)

    // Calculate direction based on value change
    const diff = prevVal - currentVal
    const dir = currentVal > prevVal ? pos * diff * -1 : negative * diff

    // Update ref after calculation
    useEffect(() => {
        prev.current = value
    }, [value])

    return (
        <AnimatePresence mode='wait'>
            <motion.div
                key={value}
                initial={{ y: dir }}
                animate={{ y: 0 }}
                exit={{ y: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className='flex relative flex-col'
            >
                {/* Numbers smaller than current */}
                <motion.span
                    layout
                    key={`negative-${value}`}
                    className={cn('flex flex-col items-center absolute bottom-full left-0')}
                >
                    {zeroToNine.filter(val => val < currentVal).map((val, idx) => (
                        <span key={`${val}_${idx}`}>{val}</span>
                    ))}
                </motion.span>

                {/* Current Number */}
                <span key={`current-${value}`}>{value}</span>

                {/* Numbers larger than current */}
                <motion.span
                    layout
                    key={`positive-${value}`}
                    className={cn('flex flex-col items-center absolute top-full left-0')}
                >
                    {zeroToNine.filter(val => val > currentVal).map((val, idx) => (
                        <span key={`${val}_${idx}`}>{val}</span>
                    ))}
                </motion.span>
            </motion.div>
        </AnimatePresence>
    )
}

export { AnimatedNumber }
