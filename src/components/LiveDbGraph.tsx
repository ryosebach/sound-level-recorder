import { useMemo } from "react";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import colors from "@/theme/colors";
import type { DecibelPoint } from "@/utils/csvParser";

type Props = {
  points: DecibelPoint[];
  windowMs: number;
  viewportWidth: number;
  height: number;
};

const Y_MIN = 0;
const Y_MAX = 130;
const DB_STEP = 20;

const MARGIN_LEFT = 36;
const MARGIN_BOTTOM = 20;
const MARGIN_TOP = 8;

const LABEL_FONT_SIZE = 10;
const GRID_COLOR = colors.borderStrong;
const GRID_LABEL_COLOR = colors.textTertiary;

function formatTimeLabel(epochMs: number): string {
  const date = new Date(epochMs);
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function LiveDbGraph({
  points,
  windowMs,
  viewportWidth,
  height,
}: Props) {
  const plotWidth = viewportWidth - MARGIN_LEFT;
  const plotHeight = height - MARGIN_TOP - MARGIN_BOTTOM;

  const nowMs = useMemo(() => {
    if (points.length === 0) return Date.now();
    // Use the latest point's timestamp as "now" for consistency
    return new Date(points[points.length - 1].timestamp).getTime();
  }, [points]);

  const windowStartMs = nowMs - windowMs;

  const dbToY = (db: number) => {
    const clamped = Math.min(Math.max(db, Y_MIN), Y_MAX);
    return MARGIN_TOP + plotHeight - ((clamped - Y_MIN) / (Y_MAX - Y_MIN)) * plotHeight;
  };

  const epochToX = (epochMs: number) => {
    return MARGIN_LEFT + ((epochMs - windowStartMs) / windowMs) * plotWidth;
  };

  // Data path
  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    const parts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const epoch = new Date(points[i].timestamp).getTime();
      const x = epochToX(epoch);
      const y = dbToY(points[i].dbSpl);
      parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return parts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, windowStartMs, windowMs, plotWidth, plotHeight]);

  // Horizontal grid lines (dB)
  const dbGridLines = useMemo(() => {
    const lines: { db: number; y: number }[] = [];
    for (let db = Y_MIN; db <= Y_MAX; db += DB_STEP) {
      lines.push({ db, y: dbToY(db) });
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotHeight]);

  // Vertical grid lines (time) - 15 second interval
  const timeGridLines = useMemo(() => {
    const interval = 15_000;
    const lines: { epochMs: number; x: number }[] = [];
    const firstTick = Math.ceil(windowStartMs / interval) * interval;
    for (let t = firstTick; t <= nowMs; t += interval) {
      lines.push({ epochMs: t, x: epochToX(t) });
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowStartMs, nowMs, windowMs, plotWidth]);

  return (
    <Svg width={viewportWidth} height={height}>
      {/* Plot background */}
      <Rect
        x={MARGIN_LEFT}
        y={MARGIN_TOP}
        width={plotWidth}
        height={plotHeight}
        fill={colors.bgSecondary}
      />

      {/* Horizontal grid lines (dB) + Y-axis labels */}
      {dbGridLines.map(({ db, y }) => (
        <Line
          key={`hg-${db}`}
          x1={MARGIN_LEFT}
          y1={y}
          x2={viewportWidth}
          y2={y}
          stroke={GRID_COLOR}
          strokeWidth={1}
        />
      ))}
      {dbGridLines.map(({ db, y }) => (
        <SvgText
          key={`hl-${db}`}
          x={MARGIN_LEFT - 4}
          y={y + 3}
          textAnchor="end"
          fontSize={LABEL_FONT_SIZE}
          fill={GRID_LABEL_COLOR}
        >
          {db}
        </SvgText>
      ))}

      {/* Vertical grid lines (time) + X-axis labels */}
      {timeGridLines.map(({ epochMs, x }) => (
        <Line
          key={`vg-${epochMs}`}
          x1={x}
          y1={MARGIN_TOP}
          x2={x}
          y2={MARGIN_TOP + plotHeight}
          stroke={GRID_COLOR}
          strokeWidth={1}
        />
      ))}
      {timeGridLines.map(({ epochMs, x }) => (
        <SvgText
          key={`vl-${epochMs}`}
          x={x}
          y={height - 4}
          textAnchor="middle"
          fontSize={LABEL_FONT_SIZE}
          fill={GRID_LABEL_COLOR}
        >
          {formatTimeLabel(epochMs)}
        </SvgText>
      ))}

      {/* Data line */}
      {pathD !== "" && (
        <Path d={pathD} fill="none" stroke={colors.accentBlue} strokeWidth={1.5} />
      )}
    </Svg>
  );
}
