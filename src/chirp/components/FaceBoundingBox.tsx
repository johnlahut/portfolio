import { motion } from 'motion/react';
import { useState } from 'react';

import type { DetectedFace } from '../types';

type FaceBoundingBoxProps = {
  face: DetectedFace;
  scaleX: number;
  scaleY: number;
  isSelected?: boolean;
  onClick?: (face: DetectedFace) => void;
  onHoverChange?: (hovered: boolean) => void;
};

type FaceState = 'tagged' | 'likely' | 'unknown';

type FaceVisualConfig = {
  state: FaceState;
  stroke: string;
  strokeHover: string;
  labelBg: string;
  labelFg: string;
  strokeDash: string;
  strokeDashHover: string;
  strokeWidth: number;
  strokeWidthHover: number;
  labelText: string;
  labelWeight: number;
  icon: React.ReactNode;
  confidence: number | null; // 0-99, null for tagged/unknown
};

// Inline lucide icon elements (viewBox 0 0 24 24, stroke-based)
const ICON_PROPS = {
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function CheckIcon({ color }: { color: string }) {
  return (
    <g stroke={color} {...ICON_PROPS}>
      <path d="M2 21a8 8 0 0 1 13.292-6" />
      <circle cx="10" cy="8" r="5" />
      <path d="m16 19 2 2 4-4" />
    </g>
  );
}

function SparklesIcon({ color }: { color: string }) {
  return (
    <g stroke={color} {...ICON_PROPS}>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
    </g>
  );
}

function QuestionIcon({ color }: { color: string }) {
  return (
    <g stroke={color} {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </g>
  );
}

const ICON_SCALE = 10 / 24; // render 24x24 icons at 10px
const MATCH_THRESHOLD = 0.5; // cosine distance threshold (mirrors backend)
const CONFIDENCE_FLOOR = 50; // below this %, treat as unknown

function toConfidencePct(distance: number): number {
  return Math.max(
    0,
    Math.min(99, Math.round((1 - distance / MATCH_THRESHOLD) * 100)),
  );
}

function getFaceVisualConfig(face: DetectedFace): FaceVisualConfig {
  const topMatch = face.matched_persons[0];
  const pct = topMatch ? toConfidencePct(topMatch.distance) : null;

  // Tagged: confirmed by user — no confidence needed
  if (face.person_id) {
    const name = topMatch?.person_name ?? 'Tagged';
    return {
      state: 'tagged',
      stroke: 'var(--face-tagged)',
      strokeHover: 'var(--face-tagged-hover)',
      labelBg: 'var(--face-tagged-label-bg)',
      labelFg: 'var(--face-tagged-label-fg)',
      strokeDash: 'none',
      strokeDashHover: 'none',
      strokeWidth: 2.5,
      strokeWidthHover: 3.5,
      labelText: name,
      labelWeight: 600,
      icon: <CheckIcon color="var(--face-tagged-label-fg)" />,
      confidence: null,
    };
  }

  // Likely: has a match above the confidence floor
  if (topMatch && pct !== null && pct >= CONFIDENCE_FLOOR) {
    return {
      state: 'likely',
      stroke: 'var(--face-likely)',
      strokeHover: 'var(--face-likely-hover)',
      labelBg: 'var(--face-likely-label-bg)',
      labelFg: 'var(--face-likely-label-fg)',
      strokeDash: '6 3',
      strokeDashHover: 'none',
      strokeWidth: 2.5,
      strokeWidthHover: 3.5,
      labelText: `${topMatch.person_name} ${pct}%`,
      labelWeight: 500,
      icon: <SparklesIcon color="var(--face-likely-label-fg)" />,
      confidence: pct,
    };
  }

  // Unknown: no match or below confidence floor
  return {
    state: 'unknown',
    stroke: 'var(--face-unknown)',
    strokeHover: 'var(--face-unknown-hover)',
    labelBg: 'var(--face-unknown-label-bg)',
    labelFg: 'var(--face-unknown-label-fg)',
    strokeDash: '3 4',
    strokeDashHover: '3 4',
    strokeWidth: 2,
    strokeWidthHover: 3,
    labelText: 'Unknown',
    labelWeight: 500,
    icon: <QuestionIcon color="var(--face-unknown-label-fg)" />,
    confidence: null,
  };
}

const LABEL_HEIGHT_BASE = 20;
const LABEL_HEIGHT_WITH_BAR = 26; // extra room for confidence bar
const LABEL_PAD_X = 8;
const LABEL_GAP = 4;
const ICON_SIZE = 10;
const ICON_TEXT_GAP = 4;
const CHAR_WIDTH = 6.5; // ~6.5px per char at fontSize 11
const BAR_HEIGHT = 3;
const BAR_MARGIN_TOP = 2;

export function FaceBoundingBox({
  face,
  scaleX,
  scaleY,
  isSelected = false,
  onClick,
  onHoverChange,
}: FaceBoundingBoxProps) {
  const [isHovered, setIsHovered] = useState(false);

  const x = face.location_left * scaleX;
  const y = face.location_top * scaleY;
  const width = (face.location_right - face.location_left) * scaleX;
  const height = (face.location_bottom - face.location_top) * scaleY;

  const highlighted = isSelected || isHovered;
  const config = getFaceVisualConfig(face);
  const hasBar = config.confidence !== null;

  const strokeColor = highlighted ? config.strokeHover : config.stroke;
  const strokeW = highlighted ? config.strokeWidthHover : config.strokeWidth;
  const strokeDash = highlighted ? config.strokeDashHover : config.strokeDash;

  // Label dimensions
  const labelHeight = hasBar ? LABEL_HEIGHT_WITH_BAR : LABEL_HEIGHT_BASE;
  const textWidth = config.labelText.length * CHAR_WIDTH;
  const labelContentWidth = ICON_SIZE + ICON_TEXT_GAP + textWidth;
  const labelWidth = labelContentWidth + LABEL_PAD_X * 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const labelX = centerX - labelWidth / 2;
  const labelY = y - labelHeight - LABEL_GAP;
  const iconX = labelX + LABEL_PAD_X;
  const iconCenterY = labelY + (hasBar ? LABEL_HEIGHT_BASE : labelHeight) / 2;
  const textX = iconX + ICON_SIZE + ICON_TEXT_GAP;
  const barY = labelY + LABEL_HEIGHT_BASE - 1 + BAR_MARGIN_TOP;
  const barMaxWidth = labelWidth - LABEL_PAD_X * 2;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ transformOrigin: `${centerX}px ${centerY}px` }}
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(false);
      }}
      onClick={() => onClick?.(face)}
      className="cursor-pointer"
    >
      {/* Glow rect (behind main rect) */}
      {highlighted && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          rx={10}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          opacity={0.3}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Main bounding box */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill="transparent"
        stroke={strokeColor}
        strokeWidth={strokeW}
        strokeDasharray={strokeDash}
        style={{
          transition:
            'stroke 150ms ease, stroke-width 150ms ease, stroke-dasharray 150ms ease',
        }}
      />

      {/* Label badge */}
      <motion.g
        animate={{ y: highlighted ? -2 : 0 }}
        transition={{ duration: 0.1 }}
      >
        <rect
          x={labelX}
          y={labelY}
          width={labelWidth}
          height={labelHeight}
          rx={10}
          fill={config.labelBg}
          opacity={0.85}
        />
        <g
          transform={`translate(${iconX}, ${iconCenterY - ICON_SIZE / 2}) scale(${ICON_SCALE})`}
        >
          {config.icon}
        </g>
        <text
          x={textX}
          y={labelY + (hasBar ? LABEL_HEIGHT_BASE : labelHeight) / 2 + 4}
          fill={config.labelFg}
          fontSize={11}
          fontFamily="Inter Variable, system-ui, sans-serif"
          fontWeight={config.labelWeight}
        >
          {config.labelText}
        </text>
        {hasBar && config.confidence !== null && (
          <>
            {/* Bar track */}
            <rect
              x={labelX + LABEL_PAD_X}
              y={barY}
              width={barMaxWidth}
              height={BAR_HEIGHT}
              rx={1.5}
              fill={config.labelFg}
              opacity={0.2}
            />
            {/* Bar fill */}
            <rect
              x={labelX + LABEL_PAD_X}
              y={barY}
              width={barMaxWidth * (config.confidence / 100)}
              height={BAR_HEIGHT}
              rx={1.5}
              fill={config.stroke}
            />
          </>
        )}
      </motion.g>
    </motion.g>
  );
}
