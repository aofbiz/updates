import React from 'react';
import { formatCurrency } from '../../utils/reportUtils';

// Validated Premium Color Palette
export const COLORS = [
    '#3b82f6', // Blue (Primary)
    '#10b981', // Emerald (Success)
    '#f59e0b', // Amber (Warning)
    '#ef4444', // Red (Danger)
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#6366f1', // Indigo
    '#84cc16', // Lime
    '#14b8a6', // Teal
];

// Shared Theme Configuration
export const chartTheme = {
    axis: {
        stroke: "#e5e7eb",
        fontSize: 12,
        tickLine: false,
        axisLine: false,
    },
    grid: {
        strokeDasharray: "3 3",
        stroke: "rgba(255,255,255,0.05)",
        vertical: false,
    },
    legend: {
        wrapperStyle: {
            fontSize: '12px',
            color: '#9ca3af',
            paddingTop: '10px'
        }
    },
    tooltipCursor: {
        fill: 'rgba(255,255,255,0.05)'
    },
    pie: {
        stroke: "none"
    },
    donut: {
        innerRadius: "45%",
        outerRadius: "65%",
        paddingAngle: 4,
        cornerRadius: 6,
        stroke: "none"
    }
};

export const DonutCenterText = ({ cx, cy, label, value, color = 'var(--text-primary)' }) => (
    <g>
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
            <tspan x={cx} dy="-0.6em" fontSize="12" fill="var(--text-muted)" fontWeight="500">
                {label}
            </tspan>
            <tspan x={cx} dy="1.4em" fontSize="18" fill={color} fontWeight="700">
                {value}
            </tspan>
        </text>
    </g>
);

// Shared Leader Line Label for Donut Charts
export const renderDonutLabel = (props) => {
    const { cx, cy, midAngle, outerRadius, value, name, fill, percent } = props;

    // Skip labels for very small segments to avoid clutter (clustering)
    if (percent < 0.03) return null;

    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-midAngle * RADIAN);
    const cos = Math.cos(-midAngle * RADIAN);
    const sx = cx + (outerRadius + 0) * cos;
    const sy = cy + (outerRadius + 0) * sin;
    const mx = cx + (outerRadius + 25) * cos;
    const my = cy + (outerRadius + 25) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 12;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    // Truncate long names
    const displayName = name.length > 14 ? name.substring(0, 12) + '..' : name;

    return (
        <g>
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1} opacity={0.6} />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={-4} textAnchor={textAnchor} fill={fill} style={{ fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>
                {displayName}
            </text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={10} textAnchor={textAnchor} fill="var(--text-muted)" style={{ fontSize: '9px' }}>
                {typeof value === 'number' && value > 1000 ? formatCurrency(value) : value} ({(percent * 100).toFixed(0)}%)
            </text>
        </g>
    );
};

export const tooltipStyle = {
    backgroundColor: '#1f2937',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
    zIndex: 1000
};

export const CustomTooltip = ({ active, payload, label, formatter }) => {
    if (active && payload && payload.length) {
        return (
            <div style={tooltipStyle}>
                {label && <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{label}</p>}
                {payload.map((entry, index) => {
                    // Handle cases where entry.name might be missing or entry.value needs formatting
                    const name = entry.name || entry.dataKey;
                    const value = entry.value;
                    const color = entry.color || entry.fill || COLORS[index % COLORS.length];

                    // Determine formatting: use prop formatter if exists, otherwise check for common monetary keys
                    let formattedValue = value;
                    if (formatter) {
                        formattedValue = formatter(value, name);
                    } else if (
                        typeof value === 'number' &&
                        (
                            (name && (name.toLowerCase().includes('revenue') || name.toLowerCase().includes('amount') || name.toLowerCase().includes('profit') || name.toLowerCase().includes('cost') || name.toLowerCase().includes('expense') || name.toLowerCase().includes('price') || name.toLowerCase().includes('gap') || name.toLowerCase().includes('collected') || name.toLowerCase().includes('pending')))
                            // Heuristic: If it looks like money, format it.
                        ) && !name.toLowerCase().includes('count') && !name.toLowerCase().includes('quantity')
                    ) {
                        formattedValue = formatCurrency(value);
                    }

                    return (
                        <div key={index} style={{ display: 'flex', flexDirection: 'column', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }}></div>
                                <span style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 500 }}>
                                    {name}: <span style={{ color: '#fff', marginLeft: '4px' }}>{formattedValue}</span>
                                </span>
                            </div>
                            {/* Special case for Orders chart to show hidden revenue data */}
                            {name === 'Orders' && entry.payload?.revenue !== undefined && (
                                <div style={{ paddingLeft: '1rem', marginTop: '2px' }}>
                                    <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                                        Rev: {formatCurrency(entry.payload.revenue)}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};
