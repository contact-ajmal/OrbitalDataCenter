import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { NoToneMapping } from 'three';
import { SCENE } from '../lib/constants';
import { Scene } from '../scene/Scene';
import { Post } from '../scene/Post';
import { Hud } from '../hud';
import { audioPreference, enableAudio, isAudioOn } from '../lib/audio';
import { useSimStore } from '../state/sim';

export function App() {
  const lowGraphics = useSimStore((s) => s.lowGraphics);

  // Pause the render loop while the tab is hidden (perf).
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? 'never' : 'always');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Honor a persisted "sound on" preference — but only on the first user
  // gesture (browsers block AudioContext otherwise).
  useEffect(() => {
    if (!audioPreference()) return;
    const start = () => {
      if (!isAudioOn()) enableAudio();
      window.removeEventListener('pointerdown', start);
    };
    window.addEventListener('pointerdown', start);
    return () => window.removeEventListener('pointerdown', start);
  }, []);

  return (
    <>
      <Canvas
        frameloop={frameloop}
        dpr={lowGraphics ? 1 : [1, 2]}
        camera={{ position: [0, SCENE.EARTH_R * 0.6, SCENE.EARTH_R * 3], fov: 35, far: 8000 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: NoToneMapping, // tonemapping handled by the Post stack when active
          preserveDrawingBuffer: true, // required for toDataURL snapshots
        }}
      >
        <color attach="background" args={['#000']} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        {!lowGraphics && <Post />}
      </Canvas>
      <Hud />
    </>
  );
}
