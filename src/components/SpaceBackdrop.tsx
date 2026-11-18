import React, { useEffect, useRef } from 'react';
import type { ThemeMode } from '../types/mayland';
import { createSpaceScene } from '../utils/spaceEngine';

interface SpaceBackdropProps {
  theme: ThemeMode;
  dimmed?: boolean;
}

const SLEEP_NIGHT_STARS: Array<{ x: number; y: number; r: number; op: number }> = [
  { x: 14, y: 16, r: 0.8, op: 0.22 },
  { x: 28, y: 9, r: 0.7, op: 0.16 },
  { x: 48, y: 21, r: 0.75, op: 0.18 },
  { x: 73, y: 14, r: 0.85, op: 0.24 },
  { x: 87, y: 24, r: 0.95, op: 0.3 },
  { x: 11, y: 58, r: 0.75, op: 0.18 },
  { x: 89, y: 66, r: 0.8, op: 0.2 },
  { x: 22, y: 84, r: 0.7, op: 0.15 },
];

export const SpaceBackdrop: React.FC<SpaceBackdropProps> = ({
  theme,
  dimmed = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<{ destroy: () => void; setDimmed: (d: boolean) => void } | null>(
    null
  );

  useEffect(() => {
    if (theme !== 'space-adventure') return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const scene = createSpaceScene(canvas, { quality: 0.8, fps: 30 });
    scene.setDimmed(dimmed);
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      scene.destroy();
    };
  }, [theme]);

  useEffect(() => {
    sceneRef.current?.setDimmed(dimmed);
  }, [dimmed]);

  if (theme !== 'space-adventure' && theme !== 'space-night') {
    return null;
  }

  if (theme === 'space-night') {
    return (
      <div
        className="space-backdrop space-backdrop-night"
        data-dimmed={dimmed ? 'true' : 'false'}
        aria-hidden="true"
      >
        <svg
          className="space-sky-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
        >
          {SLEEP_NIGHT_STARS.map((s, idx) => (
            <circle
              key={idx}
              cx={s.x}
              cy={s.y}
              r={s.r * 0.16}
              fill="var(--color-rigel-core)"
              opacity={s.op}
            />
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div
      className="space-backdrop space-backdrop-adventure"
      data-dimmed={dimmed ? 'true' : 'false'}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="space-engine-canvas" />
      <div className="space-backdrop-scrim" />
    </div>
  );
};
