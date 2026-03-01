export type DecibelPoint = { offsetMs: number; dbSpl: number };

export function parseCsv(content: string): DecibelPoint[] {
  const lines = content.split("\n");
  const points: DecibelPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;
    const parts = line.split(",");
    // CSV format: timestamp, offset_ms, db (dBFS)
    const offsetMs = Number(parts[1]);
    const dbfs = Number(parts[2]);
    if (Number.isNaN(offsetMs) || Number.isNaN(dbfs)) continue;
    points.push({ offsetMs, dbSpl: Math.max(0, dbfs + 100) });
  }
  return points;
}

export function downsample(
  points: DecibelPoint[],
  maxPoints: number
): DecibelPoint[] {
  if (points.length <= maxPoints) return points;
  const result: DecibelPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}
