import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';

/**
 * HDR post stack. The renderer runs with NoToneMapping (set on the Canvas) so
 * tonemapping happens once, here, after Bloom operates on the linear HDR buffer.
 * Bloom threshold is set so emissive layers (laser links, plumes, city lights,
 * glints) bloom while the day-side Earth albedo stays below the knee.
 */
export function Post() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={0.62}
        luminanceSmoothing={0.2}
        intensity={0.85}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.3} darkness={0.25} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.015} />
    </EffectComposer>
  );
}
