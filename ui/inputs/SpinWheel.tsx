import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";

const ITEM_HEIGHT = 38;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_Y = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

function clampIndex(index: number, maxIndex: number): number {
  return Math.max(0, Math.min(maxIndex, index));
}

export function SpinWheel({
  values,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  values: string[];
  value: string;
  onChange: (nextValue: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const safeValues = values.length > 0 ? values : ["00"];
  const maxIndex = safeValues.length - 1;
  const selectedIndex = useMemo(() => {
    const idx = safeValues.findIndex((option) => option === value);
    return idx >= 0 ? idx : 0;
  }, [safeValues, value]);

  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const activeIndexRef = useRef(selectedIndex);
  const valueRef = useRef(value);
  const draggingRef = useRef(false);
  const wheelTickRef = useRef(0);

  const minY = -maxIndex * ITEM_HEIGHT;
  const maxY = 0;
  const y = useMotionValue(-selectedIndex * ITEM_HEIGHT);

  const animateToIndex = useCallback(
    (nextIndex: number, velocity = 0) => {
      const clamped = clampIndex(nextIndex, maxIndex);
      const targetY = -clamped * ITEM_HEIGHT;
      if (reduceMotion) {
        y.set(targetY);
        return;
      }
      return animate(y, targetY, {
        type: "spring",
        stiffness: 420,
        damping: 34,
        mass: 0.62,
        velocity,
      });
    },
    [maxIndex, reduceMotion, y],
  );

  const selectIndex = useCallback(
    (nextIndex: number, velocity = 0) => {
      const clamped = clampIndex(nextIndex, maxIndex);
      if (clamped !== activeIndexRef.current) {
        activeIndexRef.current = clamped;
        setActiveIndex(clamped);
      }
      const nextValue = safeValues[clamped];
      if (nextValue && nextValue !== value) onChange(nextValue);
      animateToIndex(clamped, velocity);
    },
    [animateToIndex, maxIndex, onChange, safeValues, value],
  );

  useEffect(() => {
    const valueChanged = valueRef.current !== value;
    valueRef.current = value;
    if (selectedIndex === activeIndexRef.current) return;

    activeIndexRef.current = selectedIndex;
    setActiveIndex(selectedIndex);
    if (!valueChanged || reduceMotion) {
      y.set(-selectedIndex * ITEM_HEIGHT);
      return;
    }

    const controls = animateToIndex(selectedIndex);
    return () => controls?.stop();
  }, [animateToIndex, reduceMotion, selectedIndex, value, y]);

  useEffect(() => {
    return y.on("change", (latest) => {
      if (!draggingRef.current) return;
      const nearestIndex = clampIndex(Math.round(-latest / ITEM_HEIGHT), maxIndex);
      if (nearestIndex !== activeIndexRef.current) {
        activeIndexRef.current = nearestIndex;
        setActiveIndex(nearestIndex);
      }
    });
  }, [maxIndex, y]);

  const onWheel = useCallback(
    (ev: React.WheelEvent<HTMLDivElement>) => {
      ev.preventDefault();
      const now = performance.now();
      if (now - wheelTickRef.current < 36) return;
      wheelTickRef.current = now;
      const direction = ev.deltaY > 0 ? 1 : ev.deltaY < 0 ? -1 : 0;
      if (!direction) return;
      selectIndex(activeIndexRef.current + direction, direction * 200);
    },
    [selectIndex],
  );

  const onKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLDivElement>) => {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        selectIndex(activeIndexRef.current + 1, 220);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        selectIndex(activeIndexRef.current - 1, -220);
      } else if (ev.key === "PageDown") {
        ev.preventDefault();
        selectIndex(activeIndexRef.current + 5, 220);
      } else if (ev.key === "PageUp") {
        ev.preventDefault();
        selectIndex(activeIndexRef.current - 5, -220);
      } else if (ev.key === "Home") {
        ev.preventDefault();
        selectIndex(0);
      } else if (ev.key === "End") {
        ev.preventDefault();
        selectIndex(maxIndex);
      }
    },
    [maxIndex, selectIndex],
  );

  const activeValue = safeValues[activeIndex] ?? "";

  return (
    <div className={`w-full${className ? ` ${className}` : ""}`}>
      <div
        className="relative h-[190px] rounded-xl border border-border bg-gradient-to-b from-white/[0.05] to-black/[0.32] bg-white/[0.02] overflow-hidden touch-none outline-none select-none focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_2px_rgba(185,168,255,0.18)]"
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuemin={1}
        aria-valuemax={maxIndex + 1}
        aria-valuenow={activeIndex + 1}
        aria-valuetext={activeValue}
        tabIndex={0}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <motion.div
          className="px-2 will-change-transform cursor-grab active:cursor-grabbing"
          style={{ y, paddingTop: PADDING_Y, paddingBottom: PADDING_Y }}
          drag="y"
          dragElastic={reduceMotion ? 0 : 0.12}
          dragMomentum={false}
          dragConstraints={{ top: minY, bottom: maxY }}
          onDragStart={() => {
            draggingRef.current = true;
          }}
          onDragEnd={(_, info) => {
            draggingRef.current = false;
            const projected = y.get() + info.velocity.y * (reduceMotion ? 0.12 : 0.22);
            const bounded = Math.max(minY, Math.min(maxY, projected));
            const nextIndex = clampIndex(Math.round(-bounded / ITEM_HEIGHT), maxIndex);
            selectIndex(nextIndex, info.velocity.y);
          }}
        >
          {safeValues.map((option, idx) => {
            const distance = idx - activeIndex;
            const absDistance = Math.abs(distance);
            const style: React.CSSProperties = reduceMotion
              ? { opacity: idx === activeIndex ? 1 : 0.55 }
              : {
                  opacity: Math.max(0.14, 1 - absDistance * 0.23),
                  transform: `perspective(420px) rotateX(${-distance * 12}deg) scale(${Math.max(0.72, 1 - absDistance * 0.08)})`,
                };
            return (
              <button
                key={option}
                type="button"
                className={`w-full h-[38px] rounded-lg border-0 bg-transparent grid place-items-center text-lg font-bold tracking-widest tabular-nums origin-center transition-all cursor-pointer ${idx === activeIndex ? "text-foreground shadow-[0_7px_20px_rgba(185,168,255,0.22)]" : "text-muted-foreground"}`}
                style={style}
                onClick={() => selectIndex(idx)}
              >
                {option}
              </button>
            );
          })}
        </motion.div>

        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[38px] rounded-lg border border-primary/50 bg-primary/10 pointer-events-none" aria-hidden="true" />
        <div className="absolute left-0 right-0 h-[34%] pointer-events-none bg-gradient-to-b from-card to-transparent top-0" aria-hidden="true" />
        <div className="absolute left-0 right-0 h-[34%] pointer-events-none bg-gradient-to-t from-card to-transparent bottom-0" aria-hidden="true" />
      </div>
    </div>
  );
}
