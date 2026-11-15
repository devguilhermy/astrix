import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CylinderGeometry, DynamicDrawUsage, Group,
  InstancedMesh, MeshBasicMaterial, Object3D, Points, ShaderMaterial, Vector3,
} from 'three';
import { THRUSTER_PORTS, type ThrusterState } from './thrusterMath';

const PUFF_COUNT = 192;

/** Void Protocol-inspired overlapping white gas puffs; two draw calls for all 24 hull ports. */
export class ThrusterJets extends Group {
  private readonly nozzleGeometry = new CylinderGeometry(.000065, .000045, .00012, 8).translate(0, .00006, 0);
  private readonly nozzleMaterial = new MeshBasicMaterial({ color: '#758b9d', toneMapped: false });
  private readonly gasGeometry = new BufferGeometry();
  private readonly positions = new Float32Array(PUFF_COUNT * 3);
  private readonly velocities = new Float32Array(PUFF_COUNT * 3);
  private readonly ages = new Float32Array(PUFF_COUNT);
  private readonly lives = new Float32Array(PUFF_COUNT);
  private readonly baseSizes = new Float32Array(PUFF_COUNT);
  private readonly sizes = new Float32Array(PUFF_COUNT);
  private readonly alphas = new Float32Array(PUFF_COUNT);
  private readonly cooldowns = new Float32Array(THRUSTER_PORTS.length);
  private cursor = 0;
  active = false;
  private readonly gasMaterial = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    uniforms: { viewportHeight: { value: 1 } },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      uniform float viewportHeight;
      varying float opacity;
      void main() {
        opacity = alpha;
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size * viewportHeight * projectionMatrix[1][1] / max(-eye.z, .00001), 1.0, 96.0);
        gl_Position = projectionMatrix * eye;
      }
    `,
    fragmentShader: `
      varying float opacity;
      void main() {
        float radius = length(gl_PointCoord - .5) * 2.0;
        float edge = 1.0 - smoothstep(0.0, 1.0, radius);
        float alpha = opacity * edge * edge;
        if (alpha < .002) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `,
  });
  private readonly nozzles = new InstancedMesh(this.nozzleGeometry, this.nozzleMaterial, THRUSTER_PORTS.length);
  private readonly gas = new Points(this.gasGeometry, this.gasMaterial);

  constructor() {
    super();
    this.name = 'explore-correction-jets';
    this.gasGeometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
    this.gasGeometry.setAttribute('size', new BufferAttribute(this.sizes, 1).setUsage(DynamicDrawUsage));
    this.gasGeometry.setAttribute('alpha', new BufferAttribute(this.alphas, 1).setUsage(DynamicDrawUsage));
    this.gas.frustumCulled = this.nozzles.frustumCulled = false;
    this.gas.raycast = this.nozzles.raycast = () => {};
    this.gas.visible = false;
    const transform = new Object3D(), up = new Vector3(0, 1, 0), direction = new Vector3();
    for (let index = 0; index < THRUSTER_PORTS.length; index++) {
      const port = THRUSTER_PORTS[index]!;
      transform.position.set(...port.position);
      transform.quaternion.setFromUnitVectors(up, direction.set(...port.exhaust));
      transform.updateMatrix();
      this.nozzles.setMatrixAt(index, transform.matrix);
    }
    this.add(this.nozzles, this.gas);
  }

  /** Fixed-step emission and pool aging: no per-frame objects, geometry or material allocation. */
  step(thrusters: ThrusterState, dt: number, reducedMotion: boolean): void {
    for (let portIndex = 0; portIndex < THRUSTER_PORTS.length; portIndex++) {
      const level = thrusters.levels[portIndex]!;
      this.cooldowns[portIndex] = Math.max(0, this.cooldowns[portIndex]! - dt);
      if (level < .08 || this.cooldowns[portIndex]! > 0) continue;
      this.cooldowns[portIndex] = reducedMotion ? .14 : .07;
      const port = THRUSTER_PORTS[portIndex]!;
      for (let puff = 0; puff < 3; puff++) {
        const index = this.cursor;
        this.cursor = (index + 1) % PUFF_COUNT;
        this.ages[index] = 0;
        this.lives[index] = reducedMotion ? .28 : .45 + (index % 7) * .03;
        this.baseSizes[index] = (.00010 + (index % 5) * .000012) * (.65 + level * .35);
        for (let axis = 0; axis < 3; axis++) {
          const scatter = Math.sin(index * 13.37 + axis * 7.13);
          this.positions[index * 3 + axis] = port.position[axis] + port.exhaust[axis] * .00009 + scatter * .000035;
          this.velocities[index * 3 + axis] = (port.exhaust[axis] * (.0015 + puff * .00025) + scatter * .00015) * (reducedMotion ? .25 : 1);
        }
      }
    }
    this.active = false;
    const damping = Math.exp(-4.5 * dt);
    for (let index = 0; index < PUFF_COUNT; index++) {
      this.ages[index] += dt;
      const life = this.lives[index]!;
      if (life === 0 || this.ages[index]! >= life) {
        this.sizes[index] = this.alphas[index] = 0;
        continue;
      }
      this.active = true;
      const progress = this.ages[index]! / life;
      for (let axis = 0; axis < 3; axis++) {
        const offset = index * 3 + axis;
        this.positions[offset] += this.velocities[offset]! * dt;
        this.velocities[offset] *= damping;
      }
      this.sizes[index] = this.baseSizes[index]! * (1 + (reducedMotion ? .5 : 3) * (1 - (1 - progress) ** 2));
      this.alphas[index] = .5 * Math.min(1, progress / .1) * (1 - progress) ** 1.4;
    }
  }

  update(viewportHeight: number): void {
    this.gas.visible = this.active;
    this.gasMaterial.uniforms.viewportHeight!.value = viewportHeight;
    this.gasGeometry.attributes.position!.needsUpdate = true;
    this.gasGeometry.attributes.size!.needsUpdate = true;
    this.gasGeometry.attributes.alpha!.needsUpdate = true;
  }

  dispose(): void {
    this.nozzles.dispose();
    this.nozzleGeometry.dispose();
    this.gasGeometry.dispose();
    this.nozzleMaterial.dispose();
    this.gasMaterial.dispose();
  }
}
