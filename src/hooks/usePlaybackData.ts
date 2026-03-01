import { useEffect, useState } from "react";
import { File } from "expo-file-system/next";
import { parseCsv, downsample, type DecibelPoint } from "@/utils/csvParser";

type PlaybackDataResult =
  | { status: "loading"; points: null; durationMs: 0 }
  | { status: "error"; points: null; durationMs: 0 }
  | { status: "ready"; points: DecibelPoint[]; durationMs: number };

export function usePlaybackData(
  audioUri: string,
  maxPoints: number
): PlaybackDataResult {
  const [result, setResult] = useState<PlaybackDataResult>({
    status: "loading",
    points: null,
    durationMs: 0,
  });

  useEffect(() => {
    let cancelled = false;
    setResult({ status: "loading", points: null, durationMs: 0 });

    async function load() {
      try {
        const csvUri = audioUri.replace(/\.m4a$/, ".csv");
        const csvFile = new File(csvUri);
        if (!csvFile.exists) {
          if (!cancelled)
            setResult({ status: "error", points: null, durationMs: 0 });
          return;
        }
        const content = await csvFile.text();
        if (cancelled) return;
        const points = parseCsv(content);
        if (points.length === 0) {
          setResult({ status: "error", points: null, durationMs: 0 });
          return;
        }
        const dur = points[points.length - 1].offsetMs;
        const sampled = downsample(points, maxPoints);
        setResult({ status: "ready", points: sampled, durationMs: dur });
      } catch {
        if (!cancelled)
          setResult({ status: "error", points: null, durationMs: 0 });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [audioUri, maxPoints]);

  return result;
}
