import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from './ui';

/**
 * Finger / stylus / mouse signature box (pointer events, no extra library).
 * ref: { isEmpty(), clear(), toDataURL() } ; onChange(hasInk) after every stroke or clear.
 */
export default function SignaturePad({ ref, onChange, height = 200, label = 'Sign here' }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const ink = useRef(0); // number of points drawn
  const [empty, setEmpty] = useState(true);

  function setup() {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    c.width = Math.round(c.clientWidth * ratio);
    c.height = Math.round(c.clientHeight * ratio);
    const ctx = c.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }

  function clear() {
    setup();
    ink.current = 0;
    setEmpty(true);
    onChange?.(false);
  }

  useEffect(() => {
    setup();
    // A rotated phone changes the box size: start again only when nothing is drawn yet.
    const onResize = () => ink.current === 0 && setup();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useImperativeHandle(ref, () => ({
    isEmpty: () => ink.current < 3,
    clear,
    toDataURL: () => canvas.current.toDataURL('image/png'),
  }));

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = canvas.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = canvas.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    ink.current += 1;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const has = ink.current >= 3;
    setEmpty(!has);
    onChange?.(has);
  };

  return (
    <div>
      <div className="relative rounded-xl bg-white ring-1 ring-slate-300">
        <canvas
          ref={canvas}
          aria-label="Signature box"
          role="img"
          style={{ height, touchAction: 'none' }}
          className="block w-full cursor-crosshair rounded-xl"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        {empty && <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-slate-400">{label}</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-slate-300" />
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={clear}>
          <Eraser className="size-4" /> Clear
        </Button>
      </div>
    </div>
  );
}
