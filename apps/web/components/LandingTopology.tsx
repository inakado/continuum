"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type LandingTopologyProps = {
  className?: string;
  theme?: "light" | "dark";
};

export default function LandingTopology({ className, theme = "light" }: LandingTopologyProps) {
  const vantaRef = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<{ destroy: () => void } | null>(null);
  const [scriptsReady, setScriptsReady] = useState(false);

  useEffect(() => {
    const checkScripts = () => {
      const w = window as any;
      return w.p5 && w.VANTA && w.VANTA.TOPOLOGY;
    };

    if (checkScripts()) {
      setScriptsReady(true);
      return;
    }

    const interval = setInterval(() => {
      if (checkScripts()) {
        setScriptsReady(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!scriptsReady || !vantaRef.current) return;

    if (effectRef.current) {
      effectRef.current.destroy();
      effectRef.current = null;
    }

    const w = window as any;
    effectRef.current = w.VANTA.TOPOLOGY({
      el: vantaRef.current,
      p5: w.p5,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      color: theme === "dark" ? 0xffffff : 0x0f172a,
      backgroundColor: theme === "dark" ? 0x0f172a : 0xffffff,
    });

    return () => {
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, [scriptsReady, theme]);

  const bgColor = theme === "dark" ? "#0f172a" : "#ffffff";

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.1.9/p5.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.topology.min.js" strategy="afterInteractive" />
      <div
        ref={vantaRef}
        className={className}
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundColor: bgColor,
          transition:
            "background-color 1.0s ease, transform 2.0s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform, background-color",
          backfaceVisibility: "hidden",
        }}
      />
    </>
  );
}
