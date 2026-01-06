import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Point, Stroke, ToolType } from '../types';

interface CanvasEditorProps {
  imageSrc: string;
  tool: ToolType;
  brushSize: number;
  onMaskChange: (hasMask: boolean) => void;
  strokes: Stroke[];
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
}

export interface CanvasEditorRef {
  getMaskDataURL: () => string;
}

const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(({
  imageSrc,
  tool,
  brushSize,
  onMaskChange,
  strokes,
  setStrokes
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<Point | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImageObj(img);
      // Center image initially
      if (containerRef.current) {
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        const scaleW = containerW / img.width;
        const scaleH = containerH / img.height;
        const initialScale = Math.min(scaleW, scaleH) * 0.9;
        
        setScale(initialScale);
        setOffset({
          x: (containerW - img.width * initialScale) / 2,
          y: (containerH - img.height * initialScale) / 2
        });
      }
    };
  }, [imageSrc]);

  // Main Draw Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to container
    if (containerRef.current) {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // Apply transformations
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw Image
    ctx.drawImage(imageObj, 0, 0);

    // Draw Mask (Strokes)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    strokes.forEach(stroke => {
      if (stroke.points.length === 0) return;
      
      ctx.beginPath();
      ctx.lineWidth = stroke.size;
      // Semi-transparent red for visibility
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; 
      
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    ctx.restore();
  }, [imageObj, offset, scale, strokes]);

  useEffect(() => {
    requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    onMaskChange(strokes.length > 0);
  }, [strokes, onMaskChange]);

  // Expose mask generation to parent
  useImperativeHandle(ref, () => ({
    getMaskDataURL: () => {
      if (!imageObj) return '';
      // Create an offscreen canvas of the same size as the image
      const offCanvas = document.createElement('canvas');
      offCanvas.width = imageObj.width;
      offCanvas.height = imageObj.height;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return '';

      // Fill black (background)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

      // Draw white strokes
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#FFFFFF';

      strokes.forEach(stroke => {
        if (stroke.points.length === 0) return;
        ctx.beginPath();
        ctx.lineWidth = stroke.size;
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      });

      return offCanvas.toDataURL('image/png');
    }
  }));

  // Coordinate conversion
  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setLastMousePos({ x: clientX, y: clientY });

    if (tool === ToolType.BRUSH) {
      const point = getCanvasPoint(e);
      setStrokes(prev => [...prev, { points: [point], size: brushSize / scale }]); // Adjust brush size by scale so it looks consistent on image
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (tool === ToolType.HAND && lastMousePos) {
      const dx = clientX - lastMousePos.x;
      const dy = clientY - lastMousePos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: clientX, y: clientY });
    } else if (tool === ToolType.BRUSH) {
      const point = getCanvasPoint(e);
      setStrokes(prev => {
        const lastStroke = prev[prev.length - 1];
        if (!lastStroke) return prev;
        const newStroke = { ...lastStroke, points: [...lastStroke.points, point] };
        return [...prev.slice(0, -1), newStroke];
      });
      setLastMousePos({ x: clientX, y: clientY });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setLastMousePos(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomIntensity = 0.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = 1 + (direction * zoomIntensity);
    
    // Calculate new scale
    const newScale = Math.max(0.1, Math.min(scale * zoomFactor, 10)); // Limit zoom

    // Zoom towards mouse position
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
      const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);

      setOffset({ x: newOffsetX, y: newOffsetY });
      setScale(newScale);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative bg-[#020610] overflow-hidden cursor-crosshair touch-none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onWheel={handleWheel}
        className="block"
      />
    </div>
  );
});

CanvasEditor.displayName = 'CanvasEditor';
export default CanvasEditor;
