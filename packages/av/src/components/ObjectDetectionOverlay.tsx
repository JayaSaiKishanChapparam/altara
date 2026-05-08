import { useEffect, useRef, useState } from 'react';
import type { ObjectDetectionOverlayProps, Detection } from '../types';

const DEFAULT_PALETTE: Record<string, string> = {
  car: '#37D3E0',
  pedestrian: '#F4D03F',
  cyclist: '#D946EF',
  truck: '#1D9E75',
  sign: '#EF9F27',
  default: '#FFFFFF',
};

/**
 * Renders bounding boxes with class labels and confidence scores over a
 * camera image. Accepts a static image URL or — in mockMode — paints a
 * synthetic road scene with animated detections so you can see the
 * component working without a real perception pipeline.
 */
export function ObjectDetectionOverlay({
  imageSource,
  detections: detectionsProp,
  classColors,
  showConfidence = true,
  minConfidence = 0.3,
  width = 640,
  height = 480,
  mockMode,
  className,
}: ObjectDetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [detections, setDetections] = useState<Detection[]>(detectionsProp ?? []);

  useEffect(() => { if (detectionsProp) setDetections(detectionsProp); }, [detectionsProp]);

  useEffect(() => {
    if (typeof imageSource !== 'string') {
      imgRef.current = null;
      setImgReady(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImgReady(true);
    img.src = imageSource;
    imgRef.current = img;
  }, [imageSource]);

  // mockMode: cycle 4 detections across the road scene.
  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      const phase = (Math.sin(t * 0.5) + 1) / 2;
      setDetections([
        { label: 'car', confidence: 0.92, x: 200 + phase * 40, y: 230, w: 120, h: 80, color: DEFAULT_PALETTE['car']! },
        { label: 'car', confidence: 0.78, x: 380 - phase * 30, y: 250, w: 90, h: 60, color: DEFAULT_PALETTE['car']! },
        { label: 'pedestrian', confidence: 0.65, x: 80, y: 280, w: 35, h: 100, color: DEFAULT_PALETTE['pedestrian']! },
        { label: 'sign', confidence: 0.45 + phase * 0.3, x: 540, y: 130, w: 55, h: 55, color: DEFAULT_PALETTE['sign']!},
      ]);
    }, 60);
    return () => clearInterval(id);
  }, [mockMode]);

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

      // Background: image or synthetic road
      if (imgRef.current && imgReady) {
        ctx.drawImage(imgRef.current, 0, 0, width, height);
      } else if (mockMode) {
        // Reuse a quick synthetic scene
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#5C7A99');
        grad.addColorStop(0.55, '#3A4B5C');
        grad.addColorStop(0.55, '#222324');
        grad.addColorStop(1, '#0E0F10');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#1F2224';
        ctx.beginPath();
        ctx.moveTo(width * 0.1, height);
        ctx.lineTo(width * 0.9, height);
        ctx.lineTo(width * 0.55, height * 0.55);
        ctx.lineTo(width * 0.45, height * 0.55);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#0E0F10';
        ctx.fillRect(0, 0, width, height);
      }

      // Detections
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'top';
      for (const d of detections) {
        if (d.confidence < minConfidence) continue;
        const color = d.color ?? classColors?.[d.label] ?? DEFAULT_PALETTE[d.label] ?? DEFAULT_PALETTE['default']!;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(d.x, d.y, d.w, d.h);
        const label = showConfidence ? `${d.label} ${Math.round(d.confidence * 100)}%` : d.label;
        const labelW = ctx.measureText(label).width + 8;
        ctx.fillStyle = color;
        ctx.fillRect(d.x, d.y - 16, labelW, 16);
        ctx.fillStyle = '#000000';
        ctx.fillText(label, d.x + 4, d.y - 14);
      }
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [width, height, detections, minConfidence, showConfidence, classColors, imgReady, mockMode]);

  return (
    <div
      className={['vt-component vt-detect', className].filter(Boolean).join(' ')}
      style={{ width, height, display: 'inline-block', background: '#000', border: '1px solid var(--vt-border)' }}
      role="img"
      aria-label={`Object detection overlay — ${detections.length} detections`}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
