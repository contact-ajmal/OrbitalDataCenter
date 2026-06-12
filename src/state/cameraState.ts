/** Live camera spherical state, written each frame by CameraRig; read by the
 * permalink serializer. `restore` is consumed once on a deep-linked load. */
export const cameraState = {
  yaw: 0.5,
  pitch: 0.45,
  dist: 320,
  restore: null as { yaw: number; pitch: number; dist: number } | null,
};
