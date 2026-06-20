"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function TournamentVipLandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-vip-landing]");

    if (!root) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      root.classList.add("vip-motion-ready");
      return;
    }

    const context = gsap.context(() => {
      root.classList.add("vip-motion-ready");
      const title = root.querySelector<HTMLElement>("[data-gsap='hero-title']");
      const originalTitle = title?.textContent ?? "";

      if (title && originalTitle) {
        title.setAttribute("aria-label", originalTitle);
        title.innerHTML = originalTitle
          .split(" ")
          .map(
            (word) =>
              `<span class="vip-split-word" aria-hidden="true">${word}</span>`,
          )
          .join(" ");
      }

      gsap.set("[data-gsap]", {
        willChange: "opacity, transform, clip-path",
      });

      const heroTimeline = gsap.timeline({
        defaults: { duration: 0.85, ease: "power3.out" },
      });

      heroTimeline
        .from("[data-gsap='hero-logo']", { opacity: 0, x: -28 })
        .from(
          "[data-gsap='hero-badge']",
          { opacity: 0, y: 20, skewX: -10 },
          "-=0.45",
        )
        .from(
          "[data-gsap='hero-title'] .vip-split-word",
          {
            opacity: 0,
            x: -42,
            y: 18,
            skewX: -12,
            stagger: 0.055,
            duration: 0.82,
          },
          "-=0.35",
        )
        .from(
          "[data-gsap='hero-copy']",
          { opacity: 0, y: 24 },
          "-=0.52",
        )
        .from(
          "[data-gsap='hero-actions'] > *",
          { y: 18, scale: 0.96, stagger: 0.1 },
          "-=0.46",
        )
        .from(
          "[data-gsap='hero-signal']",
          { opacity: 0, y: 22, stagger: 0.08 },
          "-=0.36",
        )
        .set("[data-gsap='hero-actions'] > *", {
          clearProps: "opacity,transform",
        });

      gsap.to("[data-gsap='hero-badge']", {
        y: -5,
        repeat: -1,
        yoyo: true,
        duration: 1.6,
        ease: "sine.inOut",
      });

      gsap.to("[data-gsap='hero-media']", {
        scale: 1.12,
        yPercent: 8,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-gsap='hero']",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to("[data-gsap='hero-orbit']", {
        rotate: 18,
        y: -44,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-gsap='hero']",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.from("[data-gsap='value-card']", {
        opacity: 0,
        y: 56,
        rotateX: -12,
        stagger: 0.12,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-gsap='value-section']",
          start: "top 78%",
        },
      });

      gsap.fromTo(
        "[data-gsap='module-line']",
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: "left center",
          ease: "none",
          scrollTrigger: {
            trigger: "[data-gsap='value-section']",
            start: "top 82%",
            end: "bottom 46%",
            scrub: true,
          },
        },
      );

      gsap.from("[data-gsap='value-card'] svg", {
        rotate: -18,
        scale: 0.72,
        stagger: 0.1,
        duration: 0.7,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: "[data-gsap='value-section']",
          start: "top 78%",
        },
      });

      if (window.matchMedia("(min-width: 1024px)").matches) {
        ScrollTrigger.create({
          trigger: "[data-gsap='ecosystem-section']",
          start: "top top",
          end: "+=1050",
          pin: true,
          scrub: true,
        });
      }

      gsap.from("[data-gsap='ecosystem-copy'] > *", {
        opacity: 0,
        y: 34,
        stagger: 0.12,
        duration: 0.84,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-gsap='ecosystem-section']",
          start: "top 72%",
        },
      });

      gsap.fromTo(
        "[data-gsap='ecosystem-core']",
        { scale: 0.76, rotate: -8 },
        {
          scale: 1.08,
          rotate: 8,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-gsap='ecosystem-section']",
            start: "top 78%",
            end: "bottom 20%",
            scrub: true,
          },
        },
      );

      gsap.from("[data-gsap='ecosystem-node']", {
        opacity: 0,
        y: (index) => (index % 2 === 0 ? 72 : -72),
        x: (index) => (index % 2 === 0 ? -38 : 38),
        rotate: (index) => (index % 2 === 0 ? -4 : 4),
        stagger: 0.12,
        duration: 0.88,
        ease: "back.out(1.35)",
        scrollTrigger: {
          trigger: "[data-gsap='ecosystem-section']",
          start: "top 64%",
        },
      });

      gsap.to("[data-gsap='ecosystem-node']", {
        y: (index) => (index % 2 === 0 ? -32 : 32),
        ease: "none",
        scrollTrigger: {
          trigger: "[data-gsap='ecosystem-section']",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.from("[data-gsap='live-feed'] .vip-feed-row", {
        opacity: 0,
        x: 34,
        stagger: 0.08,
        duration: 0.62,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-gsap='ecosystem-section']",
          start: "top 58%",
        },
      });

      gsap.from("[data-gsap='leaderboard'] .vip-leaderboard-row", {
        opacity: 0,
        x: -24,
        stagger: 0.08,
        duration: 0.62,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-gsap='ecosystem-section']",
          start: "top 62%",
        },
      });

      gsap.to("[data-gsap='live-feed'] .vip-feed-row span", {
        opacity: 0.25,
        repeat: -1,
        yoyo: true,
        stagger: 0.16,
        duration: 0.55,
        ease: "power1.inOut",
      });

      gsap.from("[data-gsap='route-copy'] > *", {
        opacity: 0,
        x: -36,
        stagger: 0.12,
        duration: 0.78,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-gsap='route-section']",
          start: "top 72%",
        },
      });

      gsap.from("[data-gsap='route-row']", {
        opacity: 0,
        x: (index) => (index % 2 === 0 ? 70 : -70),
        skewX: (index) => (index % 2 === 0 ? -5 : 5),
        stagger: 0.1,
        duration: 0.82,
        ease: "back.out(1.4)",
        scrollTrigger: {
          trigger: "[data-gsap='route-section']",
          start: "top 65%",
        },
      });

      const marketLine = root.querySelector<SVGPathElement>(
        "[data-gsap='market-line']",
      );

      if (marketLine) {
        const length = marketLine.getTotalLength();
        gsap.set(marketLine, {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
        gsap.to(marketLine, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-gsap='market-pulse']",
            start: "top 82%",
            end: "bottom 42%",
            scrub: true,
          },
        });
      }

      gsap.from("[data-gsap='market-pulse']", {
        opacity: 0,
        y: 26,
        duration: 0.72,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-gsap='route-section']",
          start: "top 68%",
        },
      });

      gsap.to("[data-gsap='scan-beam']", {
        xPercent: 115,
        repeat: -1,
        duration: 2.4,
        ease: "power1.inOut",
        yoyo: true,
      });

      gsap.from("[data-gsap='final-cta'] > *", {
        y: 26,
        scale: 0.98,
        stagger: 0.1,
        duration: 0.74,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "[data-gsap='final-cta']",
          start: "top 84%",
        },
      });

      gsap.to("[data-gsap='final-cta']", {
        filter: "drop-shadow(0 0 34px rgba(7,17,2,0.18))",
        repeat: -1,
        yoyo: true,
        duration: 2.6,
        ease: "sine.inOut",
      });
    }, root);

    return () => {
      const title = root.querySelector<HTMLElement>("[data-gsap='hero-title']");

      if (title) {
        title.textContent = title.getAttribute("aria-label") ?? "";
      }

      context.revert();
    };
  }, []);

  return null;
}
