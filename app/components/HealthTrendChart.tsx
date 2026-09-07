"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useQuery } from "@/app/lib/convex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface HealthTrendChartProps { routerId: Id<"routers">; }

export function HealthTrendChart({ routerId }: HealthTrendChartProps) {
  const healthHistory = useQuery(api.healthSamples.getRouterHealthHistory, {
    routerId,
    hours: 24,
  });

  const themeIsDark = typeof window !== "undefined" && document.documentElement.dataset.theme === "dark";
  const lineColor = themeIsDark ? "#2A3C55" : "#FFD0A0";
  const labelColor = themeIsDark ? "#B3C0D4" : "#65758A";

  if (!healthHistory || healthHistory.length === 0) {
    return (
      <div className="workspace-card trend-card">
        <div><p className="eyebrow">Telemetry history</p><h3>24-hour health trends</h3></div>
        <p className="trend-empty">No health observations have been received for this router over the last 24 hours.</p>
      </div>
    );
  }

  // Format data for the chart
  const chartData = healthHistory
    .map((sample) => ({
      time: new Date(sample.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      cpu: sample.cpuPercent,
      memory: sample.memoryPercent,
      connectedUsers: sample.connectedUserCount ?? 0,
      transmittedBytesPerSecond: sample.txBytesPerSec,
      receivedBytesPerSecond: sample.rxBytesPerSec,
    }))
    .reverse(); // Show oldest to newest

  return (
    <div className="workspace-card trend-card">
      <div><p className="eyebrow">Telemetry history</p><h3>24-hour health trends</h3></div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid stroke={lineColor} strokeDasharray="3 3" />
          <XAxis dataKey="time" stroke={labelColor} tick={{ fill: labelColor, fontSize: 11 }} />
          <YAxis stroke={labelColor} tick={{ fill: labelColor, fontSize: 11 }} label={{ value: "Percent (%)", angle: -90, position: "insideLeft", fill: labelColor }} />
          <Tooltip />
          <Legend wrapperStyle={{ color: labelColor, fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="cpu"
            stroke="#F57C00"
            name="CPU %"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="connectedUsers"
            stroke="#2E7D32"
            name="Connected users"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="transmittedBytesPerSecond"
            stroke="#1A395B"
            name="Transmit bytes/s"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="receivedBytesPerSecond"
            stroke="#01579B"
            name="Receive bytes/s"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="memory"
            stroke="#2A5580"
            name="Memory %"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

