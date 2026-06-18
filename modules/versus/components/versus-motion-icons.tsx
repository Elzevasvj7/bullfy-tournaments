"use client";

import type { ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { SwordsIcon } from "lucide-react";

type MotionIconProps = {
  className?: string;
  title?: string;
};

export function ClashSwordsIcon({ className, title = "Versus" }: MotionIconProps) {
  const reduceMotion = useReducedMotion();
  const rootMotion = reduceMotion
    ? {}
    : {
        initial: "idle",
        animate: "idle",
        whileHover: "impact",
        whileTap: "impact",
      };

  return (
    <motion.svg
      aria-label={title}
      className={cn("overflow-visible", className)}
      fill="none"
      role="img"
      viewBox="0 0 64 64"
      {...rootMotion}
    >
      <motion.g
        variants={{
          idle: {
            rotate: -18,
            x: -3,
            y: 2,
          },
          impact: {
            rotate: 8,
            x: 2,
            y: -1,
            transition: { duration: 0.28, ease: [0.2, 0.9, 0.2, 1] },
          },
        }}
        style={{ originX: "50%", originY: "50%" }}
      >
        <SwordsIcon aria-hidden className="h-full w-full drop-shadow-[0_0_8px_rgba(182,255,61,0.55)]" />
      </motion.g>

      <motion.g
        variants={{
          idle: {
            rotate: 18,
            x: 3,
            y: 2,
          },
          impact: {
            rotate: -8,
            x: -2,
            y: -1,
            transition: { duration: 0.28, ease: [0.2, 0.9, 0.2, 1] },
          },
        }}
        style={{ originX: "50%", originY: "50%" }}
      >
               <SwordsIcon aria-hidden className="h-full w-full drop-shadow-[0_0_8px_rgba(182,255,61,0.55)]" />

      </motion.g>

      <motion.g
        stroke="#fff"
        strokeLinecap="round"
        variants={{
          idle: { opacity: 0, scale: 0.4 },
          impact: {
            opacity: [0, 1, 0],
            scale: [0.4, 1.15, 1.4],
            transition: { duration: 0.42, times: [0, 0.32, 1] },
          },
        }}
        style={{ originX: "50%", originY: "50%" }}
      >
        <path d="M32 10v8" stroke="#B6FF3D" strokeWidth="3" />
        <path d="M32 46v8" stroke="#00E5FF" strokeWidth="3" />
        <path d="M13 32h8" stroke="#FF2EC4" strokeWidth="3" />
        <path d="M43 32h8" stroke="#FF2EC4" strokeWidth="3" />
        <circle cx="32" cy="32" r="3" fill="#fff" stroke="none" />
      </motion.g>
    </motion.svg>
  );
}

export function TrophyShineIcon({ className, title = "Trofeo" }: MotionIconProps) {
  const reduceMotion = useReducedMotion();
  const rootMotion = reduceMotion
    ? {}
    : {
        initial: "idle",
        animate: "idle",
        whileHover: "shine",
        whileTap: "shine",
      };

  return (
    <motion.svg
      aria-label={title}
      className={cn("overflow-visible", className)}
      fill="none"
      role="img"
      viewBox="0 0 64 64"
      {...rootMotion}
    >
      <motion.path
        d="M22 13h20v10c0 9-4 15-10 15S22 32 22 23V13Z"
        fill="#161307"
        stroke="#FBBF24"
        strokeLinejoin="round"
        strokeWidth="3"
        variants={{
          idle: { filter: "drop-shadow(0 0 0 rgba(251,191,36,0))" },
          shine: {
            filter: "drop-shadow(0 0 14px rgba(251,191,36,0.72))",
            transition: { duration: 0.18 },
          },
        }}
      />
      <path
        d="M22 18h-8v5c0 6 4 10 9 10M42 18h8v5c0 6-4 10-9 10M32 38v9M23 52h18M27 47h10"
        stroke="#FBBF24"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <motion.path
        d="M23 35 42 16"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="4"
        variants={{
          idle: { opacity: 0, pathLength: 0 },
          shine: {
            opacity: [0, 1, 0],
            pathLength: [0, 1, 1],
            transition: { duration: 0.62, ease: "easeOut" },
          },
        }}
      />
      <motion.circle
        cx="44"
        cy="15"
        fill="#B6FF3D"
        r="2"
        variants={{
          idle: { opacity: 0.35, scale: 1 },
          shine: {
            opacity: [0.35, 1, 0.35],
            scale: [1, 1.65, 1],
            transition: { duration: 0.6 },
          },
        }}
      />
    </motion.svg>
  );
}

export function VersusCrestIcon({ className, title = "Arena versus" }: MotionIconProps) {
  const reduceMotion = useReducedMotion();
  const idleTransition = reduceMotion
    ? undefined
    : {
        duration: 2.8,
        ease: "easeInOut" as const,
        repeat: Infinity,
        repeatType: "mirror" as const,
      };

  return (
    <motion.svg
      aria-label={title}
      className={cn("overflow-visible", className)}
      fill="none"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9, rotate: -4 }}
      animate={reduceMotion ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
      role="img"
      transition={{ duration: 0.48, ease: [0.2, 0.9, 0.2, 1] }}
      viewBox="0 0 96 96"
      whileHover={reduceMotion ? undefined : "hover"}
    >
      <motion.path
        d="M48 6 84 22v26c0 22-14 35-36 42C26 83 12 70 12 48V22L48 6Z"
        fill="#071025"
        stroke="#00E5FF"
        strokeWidth="3"
        variants={{
          hover: {
            filter: "drop-shadow(0 0 18px rgba(0,229,255,0.56))",
            transition: { duration: 0.2 },
          },
        }}
      />
      <motion.path
        d="M26 35 70 65M70 35 26 65"
        stroke="#B6FF3D"
        strokeLinecap="round"
        strokeWidth="6"
        animate={reduceMotion ? undefined : { pathLength: [0.85, 1, 0.85] }}
        transition={idleTransition}
      />
      <motion.text
        fill="#fff"
        fontFamily="system-ui, sans-serif"
        fontSize="24"
        fontWeight="900"
        textAnchor="middle"
        x="48"
        y="56"
        variants={{
          hover: {
            scale: 1.08,
            transition: { duration: 0.18 },
          },
        }}
        style={{ originX: "50%", originY: "50%" }}
      >
        VS
      </motion.text>
      <motion.path
        d="M21 23h54"
        stroke="#FF2EC4"
        strokeLinecap="round"
        strokeWidth="2"
        animate={reduceMotion ? undefined : { opacity: [0.25, 0.85, 0.25] }}
        transition={idleTransition}
      />
    </motion.svg>
  );
}

export function MotionRosterCard({
  children,
  className,
  ...props
}: ComponentProps<typeof motion.article>) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -4,
              transition: { duration: 0.18, ease: "easeOut" },
            }
      }
      viewport={{ once: true, margin: "-60px" }}
      {...props}
    >
      {children}
    </motion.article>
  );
}
