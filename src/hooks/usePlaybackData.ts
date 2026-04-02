import { useEffect, useState } from "react";
import { File } from "expo-file-system/next";
import { parseCsv, downsample, type DecibelPoint } from "@/utils/csvParser";

type PlaybackDataResult =
  | { status: "loading"; points: null; durationMs: 0; startTimestamp: "" }
  | { status: "error"; points: null; durationMs: 0; startTimestamp: "" }
  | { status: "ready"; points: DecibelPoint[]; durationMs: number; startTimestamp: string };

export const usePlaybackData = (audioUri: string, maxPoints: number): PlaybackDataResult => {
  const [result, setResult] = useState<PlaybackDataResult>({
    status: "loading",
    points: null,
    durationMs: 0,
    startTimestamp: "",
  });

  useEffect(() => {
    let cancelled = false;
    setResult({ status: "loading", points: null, durationMs: 0, startTimestamp: "" });

    async function load() {
      try {
        const csvUri = audioUri.replace(/audio\.m4a$/, "decibel.csv");
        const csvFile = new File(csvUri);
        if (!csvFile.exists) {
          if (!cancelled)
            setResult({ status: "error", points: null, durationMs: 0, startTimestamp: "" });
          return;
        }
        const content = await csvFile.text();
        if (cancelled) return;
        const points = parseCsv(content);
        if (points.length === 0) {
          setResult({ status: "error", points: null, durationMs: 0, startTimestamp: "" });
          return;
        }
        const dur = points[points.length - 1].offsetMs;
        const startTimestamp = points[0].timestamp;
        const sampled = downsample(points, maxPoints);
        setResult({ status: "ready", points: sampled, durationMs: dur, startTimestamp });
      } catch {
        if (!cancelled)
          setResult({ status: "error", points: null, durationMs: 0, startTimestamp: "" });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [audioUri, maxPoints]);

  return result;
};
