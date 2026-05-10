"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { ChartPoint } from "@/lib/agents";

type Mode = "Total Return" | "Equity";

export default function PerformanceChart({
  data,
  initialBalance,
}: {
  data: ChartPoint[];
  initialBalance: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [mode, setMode] = useState<Mode>("Total Return");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#71717a",
        fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(63, 63, 70, 0.25)" },
        horzLines: { color: "rgba(63, 63, 70, 0.25)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: { color: "#52525b", width: 1, style: 2 },
        horzLine: { color: "#52525b", width: 1, style: 2 },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#22c55e",
      topColor: "rgba(34, 197, 94, 0.35)",
      bottomColor: "rgba(34, 197, 94, 0)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const points = data.map((p) => ({
      time: p.time as Time,
      value: mode === "Total Return" ? p.totalReturn : p.equity,
    }));

    const lastValue = points[points.length - 1]?.value ?? 0;
    const baseline = mode === "Total Return" ? 0 : initialBalance;
    const isPositive = lastValue >= baseline;

    series.applyOptions({
      lineColor: isPositive ? "#22c55e" : "#ef4444",
      topColor: isPositive ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)",
      bottomColor: isPositive ? "rgba(34, 197, 94, 0)" : "rgba(239, 68, 68, 0)",
      priceFormat:
        mode === "Total Return"
          ? { type: "custom", formatter: (v: number) => `${v.toFixed(0)}%`, minMove: 0.01 }
          : {
              type: "custom",
              formatter: (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
              minMove: 0.01,
            },
    });

    series.setData(points);
    chart.timeScale().fitContent();
  }, [data, mode, initialBalance]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-800/60 p-0.5 text-xs">
          {(["Total Return", "Equity"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 transition ${
                mode === m ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
          30 Days
          <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </button>
      </div>
      <div ref={containerRef} className="mt-3 flex-1" />
    </div>
  );
}
