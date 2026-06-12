// Star sparkle Points shader — per-star size + time-based twinkle.

export const starsVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vColor = aColor;
    // twinkle: 0.55..1.0 from a per-star phased sine
    float tw = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase);
    vTw = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * tw * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`;

export const starsFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor * vTw, a);
  }
`;
