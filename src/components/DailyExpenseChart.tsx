import React, { useState, useMemo } from 'react';
import { PersonalLog } from '../types';

interface DailyExpenseChartProps {
  logs: PersonalLog[];
  salaryDate?: string;
}

type TimeRange = '7d' | '14d' | '30d';

export const DailyExpenseChart: React.FC<DailyExpenseChartProps> = ({
  logs,
  salaryDate,
}) => {
  const [range, setRange] = useState<TimeRange>('7d');
  const [activePoint, setActivePoint] = useState<{
    key: string;
    dateStr: string;
    label: string;
    amount: number;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const daysCount = range === '7d' ? 7 : range === '14d' ? 14 : 30;

  // Process and aggregate daily expenses
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { amount: number; count: number }>();

    // Filter only debit logs
    logs.forEach((log) => {
      if (log.type !== 'debit') return;
      const logDate = new Date(log.timestamp);
      // Format as YYYY-MM-DD in local time
      const year = logDate.getFullYear();
      const month = String(logDate.getMonth() + 1).padStart(2, '0');
      const day = String(logDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const existing = dailyMap.get(dateKey) || { amount: 0, count: 0 };
      dailyMap.set(dateKey, {
        amount: existing.amount + log.amount,
        count: existing.count + 1,
      });
    });

    // Generate list of days ending today
    const points: {
      key: string;
      dateStr: string;
      label: string;
      shortLabel: string;
      amount: number;
      count: number;
    }[] = [];

    const today = new Date();
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const record = dailyMap.get(dateKey) || { amount: 0, count: 0 };
      const shortLabel = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: daysCount > 14 ? undefined : 'short',
      });
      const fullLabel = d.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      points.push({
        key: dateKey,
        dateStr: dateKey,
        label: fullLabel,
        shortLabel,
        amount: record.amount,
        count: record.count,
      });
    }

    return points;
  }, [logs, daysCount]);

  // Compute maximum amount for scaling
  const maxAmount = useMemo(() => {
    const maxVal = Math.max(...chartData.map((d) => d.amount), 0);
    // Return at least 500 so chart isn't flat at zero
    return maxVal > 0 ? Math.ceil(maxVal * 1.25) : 500;
  }, [chartData]);

  // Compute stats
  const totalPeriodSpend = useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.amount, 0),
    [chartData]
  );
  const avgDailySpend = Math.round(totalPeriodSpend / daysCount);

  // SVG dimensions
  const svgWidth = 320;
  const svgHeight = 110;
  const paddingX = 14;
  const paddingTop = 15;
  const paddingBottom = 22;

  const chartInnerWidth = svgWidth - paddingX * 2;
  const chartInnerHeight = svgHeight - paddingTop - paddingBottom;

  // Compute (x, y) coordinates for each point
  const mappedPoints = useMemo(() => {
    return chartData.map((item, index) => {
      const x =
        paddingX +
        (index / (chartData.length - 1 || 1)) * chartInnerWidth;
      const normalizedAmount = item.amount / maxAmount;
      const y =
        paddingTop +
        chartInnerHeight -
        normalizedAmount * chartInnerHeight;
      return {
        ...item,
        x,
        y,
      };
    });
  }, [chartData, maxAmount, chartInnerWidth, chartInnerHeight]);

  // Build SVG Path
  const linePath = useMemo(() => {
    if (mappedPoints.length === 0) return '';
    return mappedPoints.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth cubic bezier or straight lines
      const prev = mappedPoints[idx - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');
  }, [mappedPoints]);

  // Area path closing under the curve
  const areaPath = useMemo(() => {
    if (mappedPoints.length === 0) return '';
    const first = mappedPoints[0];
    const last = mappedPoints[mappedPoints.length - 1];
    const baselineY = paddingTop + chartInnerHeight;
    return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  }, [linePath, mappedPoints, chartInnerHeight]);

  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  return (
    <div className="bg-[#171f33] rounded-2xl p-4 border border-[#2d3449]/70 flex flex-col gap-3 shadow-sm">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-[#4edea3]/15 flex items-center justify-center text-[#4edea3]">
            <span className="material-symbols-outlined text-[16px]">
              show_chart
            </span>
          </div>
          <div>
            <span className="text-xs font-bold text-[#dae2fd] font-headline">
              Daily Expense Trend
            </span>
            <div className="text-[10px] text-[#bbcabf]">
              Avg <strong className="text-[#4edea3]">{formatINR(avgDailySpend)}</strong> / day
              {salaryDate && (
                <span className="ml-1 text-[10px] text-[#bbcabf]/75">
                  • Cycle from {salaryDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Range Selector */}
        <div className="bg-[#0b1326] p-0.5 rounded-lg border border-[#2d3449] flex items-center gap-0.5">
          {(['7d', '14d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                setActivePoint(null);
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                range === r
                  ? 'bg-[#4edea3] text-[#003824] shadow-xs'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Line Graph Container */}
      <div className="relative w-full overflow-hidden select-none">
        {/* Active Tooltip Popover */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none -top-1 px-2.5 py-1 bg-[#0b1326]/95 border border-[#4edea3] rounded-lg shadow-xl text-center transform -translate-x-1/2 transition-all duration-75"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
            }}
          >
            <div className="text-[11px] font-bold text-[#4edea3] font-headline">
              {formatINR(activePoint.amount)}
            </div>
            <div className="text-[9px] text-[#bbcabf]">
              {activePoint.label} {activePoint.count > 0 ? `(${activePoint.count} ${activePoint.count === 1 ? 'log' : 'logs'})` : '• No logs'}
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-28 overflow-visible"
          onMouseLeave={() => setActivePoint(null)}
        >
          <defs>
            {/* Emerald glow gradient */}
            <linearGradient id="emeraldAreaGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4edea3" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#4edea3" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#4edea3" stopOpacity="0.0" />
            </linearGradient>

            {/* Line glow filter */}
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#4edea3" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Horizontal Reference Grid lines */}
          <line
            x1={paddingX}
            y1={paddingTop + chartInnerHeight * 0.25}
            x2={svgWidth - paddingX}
            y2={paddingTop + chartInnerHeight * 0.25}
            stroke="#2d3449"
            strokeDasharray="3 3"
            strokeWidth="0.8"
            opacity="0.4"
          />
          <line
            x1={paddingX}
            y1={paddingTop + chartInnerHeight * 0.65}
            x2={svgWidth - paddingX}
            y2={paddingTop + chartInnerHeight * 0.65}
            stroke="#2d3449"
            strokeDasharray="3 3"
            strokeWidth="0.8"
            opacity="0.4"
          />
          <line
            x1={paddingX}
            y1={paddingTop + chartInnerHeight}
            x2={svgWidth - paddingX}
            y2={paddingTop + chartInnerHeight}
            stroke="#2d3449"
            strokeWidth="1"
            opacity="0.6"
          />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#emeraldAreaGlow)" />

          {/* Stroke Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#4edea3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glowEffect)"
          />

          {/* Interactive Crosshair & Point Dots */}
          {mappedPoints.map((pt) => {
            const isHovered = activePoint?.key === pt.key;
            const hasSpend = pt.amount > 0;

            return (
              <g
                key={pt.key}
                className="cursor-pointer"
                onMouseEnter={() => setActivePoint(pt)}
                onTouchStart={() => setActivePoint(pt)}
              >
                {/* Invisible larger touch target */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="14"
                  fill="transparent"
                />

                {/* Vertical marker line when hovered */}
                {isHovered && (
                  <line
                    x1={pt.x}
                    y1={paddingTop}
                    x2={pt.x}
                    y2={paddingTop + chartInnerHeight}
                    stroke="#4edea3"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                )}

                {/* Visible Data Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5 : hasSpend ? 3.5 : 2}
                  fill={isHovered ? '#6ffbbe' : hasSpend ? '#4edea3' : '#2d3449'}
                  stroke={isHovered ? '#003824' : '#0b1326'}
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all duration-100"
                />
              </g>
            );
          })}

          {/* X-Axis Day Labels */}
          {mappedPoints.map((pt, idx) => {
            // Label every step or every 2/5 steps depending on range
            const step = range === '30d' ? 6 : range === '14d' ? 3 : 1;
            const isLast = idx === mappedPoints.length - 1;
            const isFirst = idx === 0;
            if (!isLast && !isFirst && idx % step !== 0) return null;

            return (
              <text
                key={`label-${pt.key}`}
                x={pt.x}
                y={svgHeight - 4}
                textAnchor="middle"
                fontSize="8"
                fill="#bbcabf"
                fontFamily="Inter, sans-serif"
                opacity="0.75"
              >
                {pt.shortLabel}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Bottom Summary Bar */}
      <div className="flex items-center justify-between pt-1 border-t border-[#2d3449]/40 text-[11px] text-[#bbcabf]">
        <span>
          Period Spend: <strong className="text-[#dae2fd]">{formatINR(totalPeriodSpend)}</strong>
        </span>
        <span className="text-[10px] text-[#4edea3]">
          Tap any point to inspect day
        </span>
      </div>
    </div>
  );
};
