import { Color, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

const VERTEX = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHalf;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  varying vec2 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    // Distance outside the square island (0 at the shoreline).
    float d = max(abs(vWorld.x) - uHalf, abs(vWorld.y) - uHalf);

    // Depth tint: bright turquoise shallows fading into deeper blue.
    float depth = smoothstep(0.0, 9.0, d);
    vec3 color = mix(uShallow, uDeep, depth);

    // Slow drifting light bands.
    float n = noise(vWorld * 0.55 + vec2(uTime * 0.12, -uTime * 0.09));
    float bands = smoothstep(0.55, 0.62, n);
    color = mix(color, uShallow * 1.12, bands * 0.35);

    // Tiny sparkles.
    float sparkle = step(0.985, noise(vWorld * 3.1 + floor(uTime * 1.5)));
    color += sparkle * 0.18;

    // Foam: a wobbly bright band hugging the shore, plus two receding ripple rings.
    float wobble = noise(vWorld * 1.7 + uTime * 0.25) * 0.35;
    float shore = 1.0 - smoothstep(0.05, 0.55 + wobble, d);
    float ring1 = smoothstep(0.035, 0.0, abs(d - (0.95 + 0.25 * sin(uTime * 1.1)) - wobble * 0.4)) * 0.75;
    float ring2 = smoothstep(0.03, 0.0, abs(d - (1.9 + 0.3 * sin(uTime * 0.9 + 1.7)) - wobble * 0.5)) * 0.4;
    float foam = clamp(shore + ring1 + ring2, 0.0, 1.0) * step(0.0, d + 0.02);
    color = mix(color, uFoam, foam);

    // Soft shadow of the island on the water.
    color *= 1.0 - 0.14 * (1.0 - smoothstep(0.0, 2.2, d)) * (1.0 - foam);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Stylised water: depth tint, drifting light bands, sparkles and an animated shoreline foam. */
export class Water {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(islandSize: number, y: number) {
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uHalf: { value: islandSize / 2 },
        uDeep: { value: new Color(0x2a8fd8) },
        uShallow: { value: new Color(0x5fd4ee) },
        uFoam: { value: new Color(0xf4fdff) },
      },
    });
    this.mesh = new Mesh(new PlaneGeometry(260, 260), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = y;
  }

  update(time: number): void {
    this.material.uniforms['uTime']!.value = time;
  }
}
