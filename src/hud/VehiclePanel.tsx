import { Label, Panel } from './ui';
import { useUiStore } from '../state/ui';
import {
  ORBIT_ALT_KM,
  RADIATOR_M2,
  SAT_KW_AVG,
  SAT_KW_PEAK,
  SOLAR_KW,
  WINGSPAN_M,
} from '../lib/constants';

const SPECS: { label: string; value: string }[] = [
  { label: 'Wingspan', value: `${WINGSPAN_M} m` },
  { label: 'Compute', value: `${SAT_KW_AVG} / ${SAT_KW_PEAK} kW` },
  { label: 'Power density', value: '70 kW/t' },
  { label: 'Solar array', value: `~${SOLAR_KW} kW` },
  { label: 'Radiators', value: `${RADIATOR_M2} m²` },
  { label: 'Orbit', value: `~${ORBIT_ALT_KM} km SSO` },
  { label: 'Links', value: 'Laser ISL' },
  { label: 'Payload', value: 'Swappable' },
];

export function VehiclePanel() {
  const econOpen = useUiStore((s) => s.econOpen);
  if (econOpen) return null; // econ panel takes this slot
  return (
    <Panel className="absolute right-3 top-12 hidden w-[210px] p-3 hud:block">
      <div className="mb-2 border-b border-white/8 pb-2">
        <Label>AI1 // Vehicle</Label>
      </div>
      <div className="grid grid-cols-1 gap-y-[2px]">
        {SPECS.map((sp) => (
          <div key={sp.label} className="flex items-baseline justify-between gap-3 py-[2px]">
            <Label>{sp.label}</Label>
            <span className="font-mono text-[11px] tabular-nums text-ink">{sp.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-white/8 pt-2">
        <p className="text-[9px] leading-relaxed text-dim">
          Interchangeable chip payload — NVIDIA Rubin / GB300 reference, TPU planned.
          <span className="text-ink"> ≈ one GB300 rack per satellite.</span>
        </p>
      </div>
    </Panel>
  );
}
