import React, { useEffect, useState } from 'react';
import { background } from '../../appearance/backgroundManager';

const rand = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * SceneBackground - 动态对战/大厅背景
 * 分层：自定义图片 → 预设光晕 → 极光 → 云/雾 → 漂浮粒子 → 暗角与颗粒
 */
export default function SceneBackground({ variant = 'menu' }) {
  const [state, setState] = useState(() => ({
    config: background.getConfig(),
    url: background.getImageUrl(),
  }));

  useEffect(() => background.subscribe(() => {
    setState({
      config: background.getConfig(),
      url: background.getImageUrl(),
    });
  }), []);

  const { config, url } = state;
  const preset = config.preset || 'ink';
  const isGame = variant === 'game';
  const count = isGame ? 34 : 20;

  const particles = Array.from({ length: count }, (_, i) => ({
    left: rand(i + 1) * 100,
    top: rand(i + 21) * 100,
    delay: rand(i + 41) * 22,
    duration: 14 + rand(i + 61) * 22,
    size: 1 + rand(i + 81) * 2.8,
    drift: (rand(i + 101) - 0.5) * 90,
    opacity: 0.25 + rand(i + 121) * 0.55,
  }));

  return (
    <div
      className={`scene-bg preset-${preset} variant-${variant} ${config.motion ? 'motion' : ''}`}
      aria-hidden="true"
      style={{
        '--bg-dim': config.dim,
        '--bg-blur': `${config.blur}px`,
      }}>
      {preset === 'custom' && url && (
        <div className="scene-image" style={{ backgroundImage: `url("${url}")` }} />
      )}
      <div className="scene-aurora a1" />
      <div className="scene-aurora a2" />
      <div className="scene-aurora a3" />
      <div className="scene-clouds" />
      <div className="scene-particles">
        {particles.map((p, i) => (
          <span
            key={i}
            className="scene-particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
            }}
          />
        ))}
      </div>
      <div className="scene-vignette" />
      <div className="scene-grain" />
    </div>
  );
}
