"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Clock, Gauge, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";

/**
 * Bandwidth calculator — pure client-side, nothing sent anywhere.
 *
 * Three modes cover the questions operators actually ask:
 *  - "time"      : how long does this transfer take at this speed?
 *  - "capacity"  : how much can I move in this window at this speed?
 *  - "speed"     : what speed do I need to move this much in this window?
 *
 * Units use decimal multiples (1 Mbps = 1,000,000 bits), which is how ISPs
 * sell speed and how providers bill data. The note under the tool explains
 * the 1024-based (MiB) difference so an operator is never surprised.
 */

type Mode = "time" | "capacity" | "speed";
type Derived = { mode: "time"; seconds: number } | { mode: "capacity"; bits: number } | { mode: "speed"; bps: number };

const MODES: { value: Mode; label: string; icon: typeof Clock }[] = [
  { value: "time", label: "Transfer time", icon: Clock },
  { value: "capacity", label: "Capacity", icon: HardDrive },
  { value: "speed", label: "Speed needed", icon: Gauge },
];

const SIZE_UNITS = [
  { value: "KB", factor: 8e3, label: "KB" },
  { value: "MB", factor: 8e6, label: "MB" },
  { value: "GB", factor: 8e9, label: "GB" },
  { value: "TB", factor: 8e12, label: "TB" },
] as const;

const SPEED_UNITS = [
  { value: "Mbps", factor: 1e6, label: "Mbps" },
  { value: "MBps", factor: 8e6, label: "MB/s" },
] as const;

const TIME_UNITS = [
  { value: "s", factor: 1, label: "seconds" },
  { value: "m", factor: 60, label: "minutes" },
  { value: "h", factor: 3600, label: "hours" },
  { value: "d", factor: 86400, label: "days" },
] as const;

const sizeFactor = (unit: string) =>
  SIZE_UNITS.find((u) => u.value === unit)?.factor ?? 8e6;
const speedFactor = (unit: string) =>
  SPEED_UNITS.find((u) => u.value === unit)?.factor ?? 1e6;
const timeFactor = (unit: string) =>
  TIME_UNITS.find((u) => u.value === unit)?.factor ?? 3600;

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} sec`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest ? `${minutes} min ${rest} sec` : `${minutes} min`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const rest = Math.round((seconds % 3600) / 60);
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(seconds / 86400);
  const rest = Math.round((seconds % 86400) / 3600);
  return rest ? `${days} d ${rest} h` : `${days} d`;
};

const formatBits = (bits: number): string => {
  if (!Number.isFinite(bits) || bits <= 0) return "—";
  const bytes = bits / 8;
  if (bytes >= 1e12) return `${trim(bytes / 1e12)} TB`;
  if (bytes >= 1e9) return `${trim(bytes / 1e9)} GB`;
  if (bytes >= 1e6) return `${trim(bytes / 1e6)} MB`;
  return `${trim(bytes / 1e3)} KB`;
};

const formatSpeed = (bps: number): string => {
  if (!Number.isFinite(bps) || bps <= 0) return "—";
  return `${trim(bps / 1e6)} Mbps`;
};

const trim = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const numberValid = (value: string): boolean => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
};

export default function BandwidthCalculatorTool() {
  const [mode, setMode] = useState<Mode>("time");
  const [sizeValue, setSizeValue] = useState("25");
  const [sizeUnit, setSizeUnit] = useState("GB");
  const [speedValue, setSpeedValue] = useState("50");
  const [speedUnit, setSpeedUnit] = useState("Mbps");
  const [timeValue, setTimeValue] = useState("2");
  const [timeUnit, setTimeUnit] = useState("h");

  const sizeValid = numberValid(sizeValue);
  const speedValid = numberValid(speedValue);
  const timeValid = numberValid(timeValue);

  const derived = useMemo(() => {
    const inputsValid = mode === "time" ? sizeValid && speedValid : mode === "capacity" ? speedValid && timeValid : sizeValid && timeValid;
    if (!inputsValid) return null;
    const sizeBits = Number(sizeValue) * sizeFactor(sizeUnit);
    const speedBps = Number(speedValue) * speedFactor(speedUnit);
    const windowSeconds = Number(timeValue) * timeFactor(timeUnit);

    if (mode === "time") return { mode, seconds: sizeBits / speedBps } satisfies Derived;
    if (mode === "capacity") return { mode, bits: speedBps * windowSeconds } satisfies Derived;
    return { mode, bps: sizeBits / windowSeconds } satisfies Derived;
  }, [mode, sizeValue, sizeUnit, speedValue, speedUnit, timeValue, timeUnit, sizeValid, speedValid, timeValid]);

  const status = useMemo(() => {
    if (!derived) return "Enter a number greater than zero for every field.";
    if (derived.mode === "time") {
      return `≈ ${formatDuration(derived.seconds)} to move ${formatBits(Number(sizeValue) * sizeFactor(sizeUnit))} at ${formatSpeed(Number(speedValue) * speedFactor(speedUnit))}.`;
    }
    if (derived.mode === "capacity") {
      return `≈ ${formatBits(derived.bits)} moved at ${formatSpeed(Number(speedValue) * speedFactor(speedUnit))} over ${formatDuration(Number(timeValue) * timeFactor(timeUnit))}.`;
    }
    return `≈ ${formatSpeed(derived.bps)} needed to move ${formatBits(Number(sizeValue) * sizeFactor(sizeUnit))} in ${formatDuration(Number(timeValue) * timeFactor(timeUnit))}.`;
  }, [derived, sizeValue, sizeUnit, speedValue, speedUnit, timeValue, timeUnit]);

  const reset = () => {
    setMode("time");
    setSizeValue("25");
    setSizeUnit("GB");
    setSpeedValue("50");
    setSpeedUnit("Mbps");
    setTimeValue("2");
    setTimeUnit("h");
  };

  const derivedSize = mode === "capacity";
  const derivedSpeed = mode === "speed";
  const derivedTime = mode === "time";

  const field = (label: string, derivedValue: string | null, input: ReactNode) => (
    <div className={`landing-field${derivedValue !== null ? " landing-field--derived" : ""}`}>
      <label className="landing-field-label">{label}</label>
      {derivedValue !== null ? (
        <div className="landing-field-readout" aria-live="polite">
          <span className="landing-field-readout-value">{derivedValue}</span>
          <span className="landing-field-readout-note">derived</span>
        </div>
      ) : (
        input
      )}
    </div>
  );

  return (
    <div className="landing-tool">
      <div className="landing-field-tabs" role="group" aria-label="Calculation mode">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={`landing-field-tab${mode === value ? " landing-field-tab--active" : ""}`}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="landing-tool-form">
        {field(
          "Data size",
          derivedSize ? formatBits(Number(speedValue) * speedFactor(speedUnit) * Number(timeValue) * timeFactor(timeUnit)) : null,
          <div className="landing-field-input-row">
            <input
              className="landing-field-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={sizeValue}
              onChange={(event) => setSizeValue(event.target.value)}
              aria-label="Data size value"
            />
            <select
              className="landing-field-select"
              value={sizeUnit}
              onChange={(event) => setSizeUnit(event.target.value)}
              aria-label="Data size unit"
            >
              {SIZE_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
          </div>
        )}

        {field(
          "Line speed",
          derivedSpeed ? formatSpeed((Number(sizeValue) * sizeFactor(sizeUnit)) / (Number(timeValue) * timeFactor(timeUnit))) : null,
          <div className="landing-field-input-row">
            <input
              className="landing-field-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={speedValue}
              onChange={(event) => setSpeedValue(event.target.value)}
              aria-label="Line speed value"
            />
            <select
              className="landing-field-select"
              value={speedUnit}
              onChange={(event) => setSpeedUnit(event.target.value)}
              aria-label="Line speed unit"
            >
              {SPEED_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
          </div>
        )}

        {field(
          "Window",
          derivedTime ? formatDuration((Number(sizeValue) * sizeFactor(sizeUnit)) / (Number(speedValue) * speedFactor(speedUnit))) : null,
          <div className="landing-field-input-row">
            <input
              className="landing-field-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={timeValue}
              onChange={(event) => setTimeValue(event.target.value)}
              aria-label="Time window value"
            />
            <select
              className="landing-field-select"
              value={timeUnit}
              onChange={(event) => setTimeUnit(event.target.value)}
              aria-label="Time window unit"
            >
              {TIME_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>{unit.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="landing-tool-actions">
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          <RefreshCw size={15} aria-hidden="true" />
          Reset
        </Button>
        <p className="landing-tool-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <div className="landing-tool-grid" style={{ width: "100%" }}>
        <div className="landing-card landing-card-compact landing-tool-metric">
          <span className="landing-tool-label"><Clock size={15} aria-hidden="true" />Transfer time</span>
          <span className="landing-tool-value landing-tool-value-sm">
            {derived?.mode === "time" ? formatDuration(derived.seconds) : "—"}
          </span>
        </div>
        <div className="landing-card landing-card-compact landing-tool-metric">
          <span className="landing-tool-label"><HardDrive size={15} aria-hidden="true" />Capacity</span>
          <span className="landing-tool-value landing-tool-value-sm">
            {derived?.mode === "capacity" ? formatBits(derived.bits) : "—"}
          </span>
        </div>
        <div className="landing-card landing-card-compact landing-tool-metric">
          <span className="landing-tool-label"><Gauge size={15} aria-hidden="true" />Speed needed</span>
          <span className="landing-tool-value landing-tool-value-sm">
            {derived?.mode === "speed" ? formatSpeed(derived.bps) : "—"}
          </span>
        </div>
      </div>

      <p className="landing-prose-note">
        Speeds are decimal (1&nbsp;Mbps = 1,000,000 bits per second), the same convention ISPs
        sell in. Operating systems often count file sizes in 1024-based units (MiB), which runs
        roughly 2–5% higher — the difference is worth knowing when a download lands a little
        late. Nothing you type here leaves your browser.
      </p>
    </div>
  );
}
