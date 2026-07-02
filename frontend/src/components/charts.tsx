import {
  colorForCategory,
  fmtCompact,
  fmtINR,
  INCOME_COLOR,
  EXPENSE_COLOR,
  SAVED_COLOR,
  type DayWiseData,
  type YearBar,
} from "../lib/ledger";

export function Donut({
  entries,
  total,
  size = 200,
}: {
  entries: [string, number][];
  total: number;
  size?: number;
}) {
  const strokeWidth = 30;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const circles =
    total <= 0
      ? [
          <circle
            key="empty"
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#E3DBC5"
            strokeWidth={strokeWidth}
          />,
        ]
      : entries.map(([name, value], i) => {
          const frac = value / total;
          const dash = frac * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colorForCategory(name, i)}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
              strokeDashoffset={(-offset).toFixed(2)}
              transform={`rotate(-90 ${cx} ${cy})`}
            >
              <title>
                {name}: {fmtINR(value)}
              </title>
            </circle>
          );
          offset += dash;
          return el;
        });

  return (
    <svg
      className="svg-chart"
      viewBox={`0 0 ${size} ${size}`}
      style={{ maxWidth: size }}
    >
      {circles}
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="10.5"
        fill="#8A8371"
      >
        TOTAL
      </text>
      <text
        x={cx}
        y={cy + 15}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="15"
        fontWeight="600"
        fill="#1F2A24"
      >
        {fmtINR(total)}
      </text>
    </svg>
  );
}

export function GroupedBar({
  bars,
  onClickIndex,
}: {
  bars: YearBar[];
  onClickIndex?: (i: number) => void;
}) {
  const width = 640;
  const height = 240;
  const pad = { top: 12, right: 8, bottom: 26, left: 42 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...bars.map((b) => Math.max(b.Income, b.Spent)));
  const groupW = w / bars.length;
  const barW = Math.max(4, Math.min(16, groupW / 2 - 4));

  const grid = [];
  for (let s = 0; s <= 4; s++) {
    const frac = s / 4;
    const y = pad.top + h - frac * h;
    grid.push(
      <line
        key={`g${s}`}
        x1={pad.left}
        y1={y}
        x2={width - pad.right}
        y2={y}
        stroke="#DCD5C0"
        strokeWidth={1}
      />,
      <text
        key={`t${s}`}
        x={pad.left - 6}
        y={y + 3}
        textAnchor="end"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="9"
        fill="#8A8371"
      >
        {fmtCompact(frac * maxVal)}
      </text>
    );
  }

  return (
    <>
      <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`}>
        {grid}
        {bars.map((b, i) => {
          const gx = pad.left + i * groupW;
          const incH = (b.Income / maxVal) * h;
          const spH = (b.Spent / maxVal) * h;
          const incX = gx + groupW / 2 - barW - 2;
          const spX = gx + groupW / 2 + 2;
          return (
            <g
              key={i}
              style={onClickIndex ? { cursor: "pointer" } : undefined}
              onClick={onClickIndex ? () => onClickIndex(i) : undefined}
            >
              <rect
                x={gx}
                y={pad.top}
                width={groupW}
                height={h}
                fill="transparent"
              />
              <rect
                x={incX}
                y={pad.top + h - incH}
                width={barW}
                height={incH}
                rx={2}
                fill={INCOME_COLOR}
              >
                <title>
                  {b.month} Income: {fmtINR(b.Income)}
                </title>
              </rect>
              <rect
                x={spX}
                y={pad.top + h - spH}
                width={barW}
                height={spH}
                rx={2}
                fill={EXPENSE_COLOR}
              >
                <title>
                  {b.month} Spent: {fmtINR(b.Spent)}
                </title>
              </rect>
              <text
                x={gx + groupW / 2}
                y={height - 8}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="9.5"
                fill="#8A8371"
              >
                {b.month}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="svg-legend-inline">
        <div className="legend-row" style={{ padding: 0 }}>
          <span className="legend-dot" style={{ background: INCOME_COLOR }} />
          <span className="legend-name" style={{ fontSize: "12.5px" }}>
            Income
          </span>
        </div>
        <div className="legend-row" style={{ padding: 0 }}>
          <span className="legend-dot" style={{ background: EXPENSE_COLOR }} />
          <span className="legend-name" style={{ fontSize: "12.5px" }}>
            Spent
          </span>
        </div>
      </div>
    </>
  );
}

export function LineChart({
  bars,
  onClickIndex,
}: {
  bars: YearBar[];
  onClickIndex?: (i: number) => void;
}) {
  const width = 640;
  const height = 200;
  const pad = { top: 14, right: 14, bottom: 26, left: 46 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const vals = bars.map((b) => b.Saved);
  const maxVal = Math.max(1, ...vals);
  const minVal = Math.min(0, ...vals);
  const range = Math.max(1, maxVal - minVal);
  const xStep = bars.length > 1 ? w / (bars.length - 1) : 0;
  const pts = bars.map((b, i) => [
    pad.left + i * xStep,
    pad.top + h - ((b.Saved - minVal) / range) * h,
  ]);
  const path = pts
    .map(([x, y], i) => (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1))
    .join(" ");
  const zeroY = pad.top + h - ((0 - minVal) / range) * h;

  return (
    <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`}>
      <line
        x1={pad.left}
        y1={zeroY}
        x2={width - pad.right}
        y2={zeroY}
        stroke="#DCD5C0"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <path d={path} fill="none" stroke={SAVED_COLOR} strokeWidth={2.5} />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={3.5}
          fill={SAVED_COLOR}
          style={onClickIndex ? { cursor: "pointer" } : undefined}
          onClick={onClickIndex ? () => onClickIndex(i) : undefined}
        >
          <title>
            {bars[i].month}: {fmtINR(bars[i].Saved)}
          </title>
        </circle>
      ))}
      {bars.map((b, i) => (
        <text
          key={`l${i}`}
          x={pad.left + i * xStep}
          y={height - 8}
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="9.5"
          fill="#8A8371"
        >
          {b.month}
        </text>
      ))}
    </svg>
  );
}

export function StackedBar({ data }: { data: DayWiseData }) {
  const { days, cats, map } = data;
  const width = 640;
  const height = 210;
  const pad = { top: 10, right: 8, bottom: 22, left: 38 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const totals = days.map((d) =>
    cats.reduce((s, c) => s + (map[d][c] || 0), 0)
  );
  const maxVal = Math.max(1, ...totals);
  const slot = w / days.length;
  const barW = Math.max(2, slot - 3);

  const grid = [];
  for (let s = 0; s <= 3; s++) {
    const frac = s / 3;
    const y = pad.top + h - frac * h;
    grid.push(
      <line
        key={`g${s}`}
        x1={pad.left}
        y1={y}
        x2={width - pad.right}
        y2={y}
        stroke="#E9E2CD"
        strokeWidth={1}
      />,
      <text
        key={`t${s}`}
        x={pad.left - 5}
        y={y + 3}
        textAnchor="end"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="8.5"
        fill="#8A8371"
      >
        {fmtCompact(frac * maxVal)}
      </text>
    );
  }

  const bars: JSX.Element[] = [];
  days.forEach((d, i) => {
    const x = pad.left + i * slot + (slot - barW) / 2;
    let yCursor = pad.top + h;
    cats.forEach((cat, ci) => {
      const val = map[d][cat] || 0;
      if (!val) return;
      const segH = (val / maxVal) * h;
      yCursor -= segH;
      bars.push(
        <rect
          key={`${d}-${cat}`}
          x={x}
          y={yCursor}
          width={barW}
          height={segH}
          fill={colorForCategory(cat, ci)}
        >
          <title>
            Day {d} · {cat}: {fmtINR(val)}
          </title>
        </rect>
      );
    });
    if (d === 1 || d % 5 === 0 || d === days.length) {
      bars.push(
        <text
          key={`lbl${d}`}
          x={x + barW / 2}
          y={height - 6}
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="8"
          fill="#8A8371"
        >
          {d}
        </text>
      );
    }
  });

  return (
    <svg className="svg-chart" viewBox={`0 0 ${width} ${height}`}>
      {grid}
      {bars}
    </svg>
  );
}
