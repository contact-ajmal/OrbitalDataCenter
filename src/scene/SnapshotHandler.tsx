import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { on, toast } from '../lib/bus';

/**
 * Saves a PNG of the canvas on the 'snapshot' bus event. The renderer is created
 * with preserveDrawingBuffer:true (in App), so the last composed (post-processed)
 * frame is still in the buffer and toDataURL returns the real image, not black.
 */
export function SnapshotHandler() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    return on('snapshot', () => {
      const url = gl.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai1-orbital-compute-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('SNAPSHOT SAVED');
    });
  }, [gl]);

  return null;
}
