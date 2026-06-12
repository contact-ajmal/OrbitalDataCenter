// Distributed-training model (data-parallel + ring all-reduce). Pure TS.
// Each step: COMPUTE (0.8 s) then ALL-REDUCE (1.4 s). Eclipse/storm slow it
// (durations ÷ sunlitFrac). Loss follows a realistic decaying curve.

import { toast } from '../lib/bus';
import { telemetry } from '../state/telemetry';

export type TrainPhase = 'compute' | 'allreduce';

export const RUN_STEPS = 60;
const COMPUTE_DUR = 0.8;
const ALLREDUCE_DUR = 1.4;

export const training = {
  active: false,
  epoch: 1,
  step: 0,
  loss: 4.52,
  phase: 'compute' as TrainPhase,
  phaseT: 0,
  /** normalized progress of the current phase (0..1) for the viz */
  phaseProgress: 0,
  lossHistory: [] as number[],
  /** brief flash timer set when an all-reduce completes */
  flash: 0,
  justFinished: false,
};

function lossAt(step: number): number {
  return 4.2 * Math.exp(-step / 38) + 0.32 + (Math.random() * 2 - 1) * 0.02;
}

export function startTraining(): void {
  if (training.active) return;
  training.active = true;
  training.epoch = 1;
  training.step = 0;
  training.phase = 'compute';
  training.phaseT = 0;
  training.phaseProgress = 0;
  training.loss = lossAt(0);
  training.lossHistory = [training.loss];
  training.flash = 0;
  training.justFinished = false;
}

export function stopTraining(): void {
  training.active = false;
}

function complete(): void {
  training.active = false;
  training.justFinished = true;
  toast(
    `TRAINING COMPLETE — FINAL LOSS ${training.loss.toFixed(2)} · ${RUN_STEPS} STEPS ACROSS ${telemetry.count} SATELLITES`,
  );
}

/** Advance the run by `simDelta` seconds at the given fleet sunlit fraction. */
export function tickTraining(simDelta: number, sunlitFrac: number): void {
  if (training.flash > 0) training.flash = Math.max(0, training.flash - simDelta);
  if (!training.active) return;

  const base = training.phase === 'compute' ? COMPUTE_DUR : ALLREDUCE_DUR;
  const eff = base / Math.max(0.12, sunlitFrac); // dark fleet trains slower
  training.phaseT += simDelta;
  training.phaseProgress = Math.min(1, training.phaseT / eff);

  if (training.phaseT >= eff) {
    training.phaseT = 0;
    if (training.phase === 'compute') {
      training.phase = 'allreduce';
    } else {
      training.phase = 'compute';
      training.flash = 0.25; // cross-plane reduce flash
      training.step++;
      training.epoch = Math.floor(training.step / 20) + 1;
      if (training.step >= RUN_STEPS) {
        complete();
        return;
      }
      training.loss = lossAt(training.step);
      training.lossHistory.push(training.loss);
    }
  }
}
