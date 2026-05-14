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

/**
 * DustTrail — emits small puffs behind a moving target (Hanna).
 * Sells speed visually. Cheap, all instanced points.
 */
export class DustTrail {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.mat = new THREE.PointsMaterial({
      color: 0xc9a978,
      size: 0.4,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.geom = new THREE.BufferGeometry();
    this.MAX = 60;
    this.positions = new Float32Array(this.MAX * 3);
    this.life = new Float32Array(this.MAX); // age normalized 0..1
    for (let i = 0; i < this.MAX; i++) this.life[i] = 1; // dead
    this.geom.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.points = new THREE.Points(this.geom, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.head = 0;
    this.lastSpawnT = 0;
  }

  /** Spawn rate scales with player speed. */
  emit(x, y, z, now) {
    if (now - this.lastSpawnT < 0.04) return;
    this.lastSpawnT = now;
    const i = this.head;
    this.positions[i * 3 + 0] = x + (Math.random() - 0.5) * 0.4;
    this.positions[i * 3 + 1] = y + 0.2;
    this.positions[i * 3 + 2] = z - 0.4;
    this.life[i] = 0;
    this.head = (this.head + 1) % this.MAX;
  }

  update(dt) {
    let anyAlive = false;
    for (let i = 0; i < this.MAX; i++) {
      if (this.life[i] >= 1) continue;
      this.life[i] += dt * 1.5; // ~0.66s lifetime
      // drift up & back
      this.positions[i * 3 + 1] += dt * 0.6;
      this.positions[i * 3 + 2] -= dt * 0.5;
      anyAlive = true;
    }
    if (anyAlive) this.geom.attributes.position.needsUpdate = true;
    // Average opacity by youngest particle
    this.mat.opacity = 0.45;
  }
}

/**
 * Butterflies — a few drifting in the camera's vicinity. Life in the world.
 */
export class Butterflies {
  constructor(scene, count = 6) {
    this.scene = scene;
    this.list = [];
    const colors = [0xffa3d1, 0xfff5a3, 0xa3d1ff, 0xffb88c];
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const wing1 = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.16),
        new THREE.MeshBasicMaterial({
          color: colors[i % colors.length],
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
      );
      wing1.position.x = -0.1;
      g.add(wing1);
      const wing2 = wing1.clone();
      wing2.position.x = 0.1;
      g.add(wing2);
      g.userData = {
        wing1,
        wing2,
        phase: Math.random() * Math.PI * 2,
        baseY: 0.6 + Math.random() * 1.4,
        radius: 1 + Math.random() * 1.5,
      };
      scene.add(g);
      this.list.push(g);
    }
  }

  /** Keep them roughly with the player but wandering. */
  update(dt, hannaPos) {
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      const u = b.userData;
      u.phase += dt * 1.8;
      // Anchor to a nearby spot relative to Hanna, with circular drift
      const anchorX = hannaPos.x + (i % 2 === 0 ? -3 : 3) + Math.sin(t * 0.3 + i) * 1.5;
      const anchorZ = hannaPos.z + 4 + i * 1.4;
      b.position.x = anchorX + Math.cos(u.phase) * u.radius;
      b.position.y = u.baseY + Math.sin(u.phase * 1.3) * 0.3;
      b.position.z = anchorZ + Math.sin(u.phase * 0.7) * u.radius;
      // Wing flap
      const flap = Math.sin(t * 18 + u.phase) * 0.7;
      u.wing1.rotation.y = flap;
      u.wing2.rotation.y = -flap;
      // Face Hanna roughly
      b.lookAt(hannaPos.x, b.position.y, hannaPos.z);
    }
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
