import { View, Text } from "react-native";
import Svg, { Polyline, Line, Circle, Text as SvgText } from "react-native-svg";
import { colors } from "../constants/tokens";
import type { ForecastPoint } from "../types/api";

interface LineChartProps {
  points: ForecastPoint[];
  width?: number;
  height?: number;
}

const PADDING = { top: 16, right: 12, bottom: 28, left: 40 };

export default function LineChart({ points, width = 320, height = 200 }: LineChartProps) {
  if (points.length < 2) {
    return (
      <View
        className="items-center justify-center bg-surface-lavender rounded-md"
        style={{ width, height }}
      >
        <Text
          className="text-secondary-text text-sm"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          Not enough data points
        </Text>
      </View>
    );
  }

  const values = points.map((p) => p.value ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  function x(i: number) {
    return PADDING.left + (i / (points.length - 1)) * chartW;
  }

  function y(v: number) {
    return PADDING.top + chartH - ((v - min) / range) * chartH;
  }

  const observed = points.filter((p) => p.kind === "observed" && p.value !== null);
  const predicted = points.filter((p) => p.kind === "predicted" && p.value !== null);

  function polylinePoints(subset: ForecastPoint[]) {
    return subset
      .map((p) => {
        const idx = points.indexOf(p);
        return `${x(idx)},${y(p.value!)}`;
      })
      .join(" ");
  }

  const yTicks = 4;
  const step = range / yTicks;

  const xLabelCount = Math.min(4, points.length);
  const xStep = Math.floor((points.length - 1) / (xLabelCount - 1));

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const val = min + step * i;
          const yPos = y(val);
          return (
            <Line
              key={`grid-${i}`}
              x1={PADDING.left}
              y1={yPos}
              x2={width - PADDING.right}
              y2={yPos}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}

        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const val = min + step * i;
          return (
            <SvgText
              key={`ylabel-${i}`}
              x={PADDING.left - 4}
              y={y(val) + 4}
              textAnchor="end"
              fontSize={10}
              fill={colors.secondaryText}
            >
              {val.toFixed(1)}
            </SvgText>
          );
        })}

        {Array.from({ length: xLabelCount }, (_, i) => {
          const idx = i * xStep;
          const p = points[idx];
          if (!p) return null;
          const d = new Date(p.timestamp);
          const label = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          return (
            <SvgText
              key={`xlabel-${i}`}
              x={x(idx)}
              y={height - 4}
              textAnchor="middle"
              fontSize={10}
              fill={colors.secondaryText}
            >
              {label}
            </SvgText>
          );
        })}

        {observed.length >= 2 && (
          <Polyline
            points={polylinePoints(observed)}
            fill="none"
            stroke={colors.lavender}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}

        {predicted.length >= 2 && (
          <Polyline
            points={polylinePoints(predicted)}
            fill="none"
            stroke={colors.sky}
            strokeWidth={2}
            strokeDasharray="4,4"
            strokeLinejoin="round"
          />
        )}

        {observed.length > 0 && (() => {
          const last = observed[observed.length - 1];
          const idx = points.indexOf(last);
          return (
            <Circle
              cx={x(idx)}
              cy={y(last.value!)}
              r={4}
              fill={colors.lavender}
            />
          );
        })()}
      </Svg>
    </View>
  );
}
