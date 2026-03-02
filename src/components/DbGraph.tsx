import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import colors from "@/theme/colors";
import type { DecibelPoint } from "@/utils/csvParser";

type Props = {
  points: DecibelPoint[];
  durationMs: number;
  currentTimeMs: number;
  viewportWidth: number;
  height: number;
  startTimestamp: string;
  onSeek: (ms: number) => void;
};

const Y_MIN = 0;
const Y_MAX = 130;
const DB_STEP = 20;

// Margins for axis labels
const MARGIN_LEFT = 36;
const MARGIN_BOTTOM = 20;
const MARGIN_TOP = 24;

const LABEL_FONT_SIZE = 10;
const CURSOR_FONT_SIZE = 11;
const GRID_COLOR = colors.borderStrong;
const GRID_LABEL_COLOR = colors.textTertiary;

function formatTimeLabel(ms: number, startEpochMs: number): string {
  const date = new Date(startEpochMs + ms);
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Pick a nice round time-grid interval (in ms) based on the viewport scale. */
function pickTimeInterval(msPerViewport: number): number {
  // Aim for roughly 4-6 labels per viewport
  const target = msPerViewport / 5;
  const candidates = [
    1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000,
    600_000, 900_000, 1_800_000, 3_600_000,
  ];
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return candidates[candidates.length - 1];
}

export default function DbGraph({
  points,
  durationMs,
  currentTimeMs,
  viewportWidth,
  height,
  startTimestamp,
  onSeek,
}: Props) {
  const startEpochMs = useMemo(() => new Date(startTimestamp).getTime(), [startTimestamp]);
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const plotHeight = height - MARGIN_TOP - MARGIN_BOTTOM;
  const plotWidth = viewportWidth - MARGIN_LEFT;

  // 1 minute = plotWidth
  const durationMin = Math.max(durationMs / 60000, 1);
  const totalPlotWidth = plotWidth * durationMin;
  const totalSvgWidth = MARGIN_LEFT + totalPlotWidth;

  // Convert dB value to Y coordinate within the plot area
  const dbToY = useCallback(
    (db: number) => {
      const clamped = Math.min(Math.max(db, Y_MIN), Y_MAX);
      return MARGIN_TOP + plotHeight - ((clamped - Y_MIN) / (Y_MAX - Y_MIN)) * plotHeight;
    },
    [plotHeight]
  );

  // Convert offsetMs to X coordinate
  const msToX = useCallback(
    (ms: number) => {
      return MARGIN_LEFT + (ms / durationMs) * totalPlotWidth;
    },
    [durationMs, totalPlotWidth]
  );

  // --- Data path ---
  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    const parts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const x = msToX(points[i].offsetMs);
      const y = dbToY(points[i].dbSpl);
      parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return parts.join(" ");
  }, [points, msToX, dbToY]);

  // --- Horizontal grid lines (dB) ---
  const dbGridLines = useMemo(() => {
    const lines: { db: number; y: number }[] = [];
    for (let db = Y_MIN; db <= Y_MAX; db += DB_STEP) {
      lines.push({ db, y: dbToY(db) });
    }
    return lines;
  }, [dbToY]);

  // --- Vertical grid lines (time) ---
  const timeGridLines = useMemo(() => {
    // ms per viewport (plotWidth pixels)
    const msPerViewport = durationMs / durationMin;
    const interval = pickTimeInterval(msPerViewport);
    const lines: { ms: number; x: number }[] = [];
    for (let t = 0; t <= durationMs; t += interval) {
      lines.push({ ms: t, x: msToX(t) });
    }
    return lines;
  }, [durationMs, durationMin, msToX]);

  // --- Cursor ---
  const cursorX = msToX(currentTimeMs);

  // Get current dB at cursor position by finding nearest point
  const currentDb = useMemo(() => {
    if (points.length === 0) return 0;
    let closest = points[0];
    let closestDist = Math.abs(points[0].offsetMs - currentTimeMs);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].offsetMs - currentTimeMs);
      if (dist < closestDist) {
        closest = points[i];
        closestDist = dist;
      } else {
        break; // points are sorted by offsetMs
      }
    }
    return closest.dbSpl;
  }, [points, currentTimeMs]);

  // --- Cursor label positioning (avoid clipping at edges) ---
  const cursorDbLabel = `${currentDb.toFixed(0)} dB`;
  const cursorTimeLabel = formatTimeLabel(currentTimeMs, startEpochMs);
  const labelWidth = 56;
  const labelHalf = labelWidth / 2;

  // Clamp label center X to stay within the SVG boundaries
  const labelCenterX = Math.max(
    MARGIN_LEFT + labelHalf,
    Math.min(cursorX, totalSvgWidth - labelHalf)
  );

  // Auto-scroll to follow playback cursor
  useEffect(() => {
    if (isUserScrolling.current) return;
    const targetX = cursorX - MARGIN_LEFT - plotWidth / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, targetX), animated: false });
  }, [cursorX, plotWidth]);

  const handlePress = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      const xInPlot = e.nativeEvent.locationX - MARGIN_LEFT;
      if (xInPlot < 0) return;
      const tappedMs = (xInPlot / totalPlotWidth) * durationMs;
      onSeek(Math.max(0, Math.min(durationMs, tappedMs)));
    },
    [totalPlotWidth, durationMs, onSeek]
  );

  const handleScrollBegin = useCallback(() => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
  }, []);

  const handleScrollEnd = useCallback(() => {
    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 3000);
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator
      onScrollBeginDrag={handleScrollBegin}
      onScrollEndDrag={handleScrollEnd}
      onMomentumScrollEnd={handleScrollEnd}
    >
      <Pressable onPress={handlePress}>
        <Svg width={totalSvgWidth} height={height}>
          {/* --- Plot background --- */}
          <Rect
            x={MARGIN_LEFT}
            y={MARGIN_TOP}
            width={totalPlotWidth}
            height={plotHeight}
            fill={colors.bgSecondary}
          />

          {/* --- Horizontal grid lines (dB) + Y-axis labels --- */}
          {dbGridLines.map(({ db, y }) => (
            <Line
              key={`hg-${db}`}
              x1={MARGIN_LEFT}
              y1={y}
              x2={totalSvgWidth}
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

          {/* --- Vertical grid lines (time) + X-axis labels --- */}
          {timeGridLines.map(({ ms, x }) => (
            <Line
              key={`vg-${ms}`}
              x1={x}
              y1={MARGIN_TOP}
              x2={x}
              y2={MARGIN_TOP + plotHeight}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          ))}
          {timeGridLines.map(({ ms, x }) => (
            <SvgText
              key={`vl-${ms}`}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize={LABEL_FONT_SIZE}
              fill={GRID_LABEL_COLOR}
            >
              {formatTimeLabel(ms, startEpochMs)}
            </SvgText>
          ))}

          {/* --- Data line --- */}
          {pathD !== "" && (
            <Path d={pathD} fill="none" stroke={colors.accentBlue} strokeWidth={1.5} />
          )}

          {/* --- Cursor line --- */}
          <Line
            x1={cursorX}
            y1={MARGIN_TOP}
            x2={cursorX}
            y2={MARGIN_TOP + plotHeight}
            stroke={colors.accentRed}
            strokeWidth={2}
          />

          {/* --- Cursor dB label (above) --- */}
          <Rect
            x={labelCenterX - labelHalf}
            y={MARGIN_TOP - 18}
            width={labelWidth}
            height={16}
            rx={3}
            fill={colors.accentRed}
          />
          <SvgText
            x={labelCenterX}
            y={MARGIN_TOP - 6}
            textAnchor="middle"
            fontSize={CURSOR_FONT_SIZE}
            fontWeight="bold"
            fill={colors.onAccent}
          >
            {cursorDbLabel}
          </SvgText>

          {/* --- Cursor time label (below) --- */}
          <Rect
            x={labelCenterX - labelHalf}
            y={MARGIN_TOP + plotHeight + 2}
            width={labelWidth}
            height={16}
            rx={3}
            fill={colors.accentRed}
          />
          <SvgText
            x={labelCenterX}
            y={MARGIN_TOP + plotHeight + 14}
            textAnchor="middle"
            fontSize={CURSOR_FONT_SIZE}
            fontWeight="bold"
            fill={colors.onAccent}
          >
            {cursorTimeLabel}
          </SvgText>
        </Svg>
      </Pressable>
    </ScrollView>
  );
}
