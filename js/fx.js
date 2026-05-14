import * as THREE from "three";

/** Pooled particle bursts. Cheap, additive-blend points. */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
  }

  burst(position, opts = {}) {
    const count = opts.count ?? 18;
    const color = opts.color ?? 0xffd54a;
    const speed = opts.speed ?? 4;
    const life = opts.life ?? 0.6;
    const size = opts.size ?? 0.15;

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const a = Math.random() * Math.PI * 2;
      const p = (Math.random() - 0.5) * Math.PI;
      const sp = speed * (0.5 + Math.random());
      velocities.push(
        Math.cos(a) * Math.cos(p) * sp,
        Math.sin(p) * sp + 1,
        Math.sin(a) * Math.cos(p) * sp
      );
    }
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.bursts.push({ points, velocities, life, age: 0 });
  }

  update(dt) {
    const keep = [];
    for (const b of this.bursts) {
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        continue;
      }
      const pos = b.points.geometry.attributes.position.array;
      for (let i = 0; i < b.velocities.length; i += 3) {
        pos[i + 0] += b.velocities[i + 0] * dt;
        pos[i + 1] += b.velocities[i + 1] * dt - 4 * dt; // gravity-ish
        pos[i + 2] += b.velocities[i + 2] * dt;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      b.points.material.opacity = 1 - t;
      keep.push(b);
    }
    this.bursts = keep;
  }
}

/** Screen shake via camera offset. */
export class CameraShaker {
  constructor() {
    this.amount = 0;
    this.decay = 6;
  }
  shake(amt) {
    this.amount = Math.min(0.5, this.amount + amt);
  }
  apply(camera, dt) {
    if (this.amount <= 0.001) {
      this.amount = 0;
      return { x: 0, y: 0 };
    }
    const a = this.amount;
    this.amount = Math.max(0, this.amount - this.decay * dt);
    return {
      x: (Math.random() - 0.5) * a,
      y: (Math.random() - 0.5) * a,
    };
  }
}
