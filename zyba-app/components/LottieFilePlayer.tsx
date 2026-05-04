"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";

type LottieAnimationData = Record<string, unknown>;

type LottieFilePlayerProps = {
  src: string;
  className?: string;
  loop?: boolean;
};

export default function LottieFilePlayer({
  src,
  className,
  loop = true,
}: LottieFilePlayerProps) {
  const [animationData, setAnimationData] = useState<LottieAnimationData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(src, { cache: "force-cache" });
        if (!response.ok) return;
        const data = (await response.json()) as LottieAnimationData;
        if (!cancelled) {
          setAnimationData(data);
        }
      } catch {
        if (!cancelled) {
          setAnimationData(null);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!animationData) {
    return null;
  }

  return <Lottie animationData={animationData} loop={loop} className={className} />;
}
