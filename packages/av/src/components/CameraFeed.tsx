import { useEffect, useRef, useState } from 'react';
import type { CameraFeedProps } from '../types';

/**
 * Camera-feed display. Either a static/MJPEG `imageUrl`, or a custom
 * `dataSource` that emits frames (real implementations would attach a
 * worker for sensor_msgs/CompressedImage decoding). In `mockMode` we
 * paint a synthetic "road ahead" scene with moving lane markings so
 * downstream overlays (ObjectDetectionOverlay) have something to anchor to.
 */
export function CameraFeed({
  dataSource: _dataSource,
  imageUrl,
  overlays = [],
  width = 640,
  height = 480,
  label,
  mockMode,
  className,
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      imgRef.current = null;
      setImgReady(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImgReady(true);
    img.src = imageUrl;
    imgRef.current = img;
    return () => {
      imgRef.current = null;
      setImgReady(false);
    };
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);

      if (imgRef.current && imgReady) {
        ctx.drawImage(imgRef.current, 0, 0, width, height);
      } else if (mockMode) {
        drawMockRoad(ctx, width, height, performance.now());
      } else {
        ctx.fillStyle = '#0E0F10';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#7A7872';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NO IMAGE', width / 2, height / 2);
      }

      // Overlays
      for (const o of overlays) {
        if (o.type === 'crosshair') {
          ctx.strokeStyle = o.color ?? 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(width / 2, 0);
          ctx.lineTo(width / 2, height);
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();
        } else if (o.type === 'grid') {
          ctx.strokeStyle = o.color ?? 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 1;
          for (let x = width / 4; x < width; x += width / 4) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
          }
          for (let y = height / 4; y < height; y += height / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
          }
        } else if (o.type === 'box' && o.x !== undefined && o.y !== undefined && o.w && o.h) {
          ctx.strokeStyle = o.color ?? '#37D3E0';
          ctx.lineWidth = 2;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
      }

      // Label
      if (label) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(8, 8, ctx.measureText(label).width + 12, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, 14, 12);
      }
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [width, height, overlays, label, mockMode, imgReady]);

  return (
    <div
      className={['vt-component vt-camera', className].filter(Boolean).join(' ')}
      style={{ width, height, display: 'inline-block', background: '#000', border: '1px solid var(--vt-border)' }}
      role="img"
      aria-label={label ? `Camera feed: ${label}` : 'Camera feed'}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

function drawMockRoad(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  // Sky → ground gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#5C7A99');
  grad.addColorStop(0.55, '#3A4B5C');
  grad.addColorStop(0.55, '#222324');
  grad.addColorStop(1, '#0E0F10');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Vanishing-point road
  ctx.fillStyle = '#1F2224';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h);
  ctx.lineTo(w * 0.9, h);
  ctx.lineTo(w * 0.55, h * 0.55);
  ctx.lineTo(w * 0.45, h * 0.55);
  ctx.closePath();
  ctx.fill();

  // Lane markings — dashed centerline scrolling toward the camera
  const segs = 8;
  const offset = (t / 30) % (h / segs);
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < segs; i++) {
    const y0 = h - i * (h / segs) - offset;
    const y1 = y0 - 18;
    if (y0 < h * 0.55) continue;
    const f0 = (y0 - h * 0.55) / (h - h * 0.55);
    const f1 = (y1 - h * 0.55) / (h - h * 0.55);
    const halfW0 = 4 * f0;
    const halfW1 = 4 * f1;
    const cx0 = w / 2;
    const cx1 = w / 2;
    ctx.beginPath();
    ctx.moveTo(cx0 - halfW0, y0);
    ctx.lineTo(cx0 + halfW0, y0);
    ctx.lineTo(cx1 + halfW1, y1);
    ctx.lineTo(cx1 - halfW1, y1);
    ctx.closePath();
    ctx.fill();
  }
}
