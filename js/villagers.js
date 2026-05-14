import * as THREE from "three";

const NAMES = [
  "Greta", "Linnea", "Otto", "Mira", "Bjorn", "Astrid",
  "Finn", "Saga", "Elin", "Kai", "Nora", "Wren",
];

const SHIRTS = [0x4ca6e0, 0xff8a8a, 0x9b5de5, 0x6fb058, 0xffa94d, 0xfee440];
const HAIRS = [0x3a2614, 0xc97a2b, 0xe8c87a, 0x6b3e20, 0xff8c00];

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function sphere(r, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * One villager. Smaller and simpler than Hanna, but same chunky vibe.
 */
class Villager {
  constructor(name, opts = {}) {
    this.name = name;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    const shirt = opts.shirt ?? SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
    const hair = opts.hair ?? HAIRS[Math.floor(Math.random() * HAIRS.length)];

    // Legs
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    const legGeom = new THREE.BoxGeometry(0.22, 0.4, 0.22);
    const legMat = toon(0x4a2a16);
    const lL = new THREE.Mesh(legGeom, legMat);
    lL.position.y = -0.2;
    lL.castShadow = true;
    this.legL.add(lL);
    const lR = new THREE.Mesh(legGeom, legMat);
    lR.position.y = -0.2;
    lR.castShadow = true;
    this.legR.add(lR);
    this.legL.position.set(-0.15, 0.4, 0);
    this.legR.position.set(0.15, 0.4, 0);
    this.body.add(this.legL, this.legR);

    // Torso
    this.body.add(box(0.5, 0.45, 0.4, shirt, 0, 0.85, 0));

    // Arms
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    const armGeom = new THREE.BoxGeometry(0.18, 0.4, 0.18);
    const armMat = toon(shirt);
    const aL = new THREE.Mesh(armGeom, armMat);
    aL.position.y = -0.18;
    aL.castShadow = true;
    this.armL.add(aL);
    this.armL.add(sphere(0.1, 0xf5cfa0, 0, -0.4, 0));
    const aR = new THREE.Mesh(armGeom, armMat);
    aR.position.y = -0.18;
    aR.castShadow = true;
    this.armR.add(aR);
    this.armR.add(sphere(0.1, 0xf5cfa0, 0, -0.4, 0));
    this.armL.position.set(-0.32, 1.05, 0);
    this.armR.position.set(0.32, 1.05, 0);
    this.body.add(this.armL, this.armR);

    // Head
    this.head = new THREE.Group();
    this.head.position.set(0, 1.4, 0);
    this.body.add(this.head);
    this.head.add(sphere(0.32, 0xf5cfa0, 0, 0, 0));
    // Hair cap
    const hairCap = sphere(0.34, hair, 0, 0.04, -0.02);
    hairCap.scale.set(1, 0.85, 1);
    this.head.add(hairCap);
    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1c1c });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    e1.position.set(-0.1, 0.02, 0.29);
    e1.scale.set(0.6, 1.0, 0.5);
    const e2 = e1.clone();
    e2.position.x = 0.1;
    this.head.add(e1, e2);

    // Shadow disc
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 16),
      new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.group.add(shadow);

    this.t = Math.random() * 100;
    this.target = null;
    this.speed = 0.8 + Math.random() * 0.4;
    this.idleUntil = 0;
  }

  pickWanderTarget(half) {
    this.target = new THREE.Vector3(
      (Math.random() - 0.5) * half * 1.6,
      0,
      (Math.random() - 0.5) * half * 1.6
    );
  }

  update(dt, half) {
    this.t += dt;
    let walking = false;

    if (!this.target) {
      if (this.t > this.idleUntil) {
        this.pickWanderTarget(half);
      }
    } else {
      const dx = this.target.x - this.group.position.x;
      const dz = this.target.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.2) {
        const step = Math.min(this.speed * dt, dist);
        const ang = Math.atan2(dx, dz);
        this.group.position.x += Math.sin(ang) * step;
        this.group.position.z += Math.cos(ang) * step;
        let diff = ang - this.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1, dt * 6);
        walking = true;
      } else {
        this.target = null;
        this.idleUntil = this.t + 1 + Math.random() * 2;
      }
    }

    const bob = walking ? Math.abs(Math.sin(this.t * 8)) * 0.04 : Math.sin(this.t * 1.8) * 0.02;
    this.body.position.y = bob;

    if (walking) {
      const phase = this.t * 9;
      this.legL.rotation.x = Math.sin(phase) * 0.5;
      this.legR.rotation.x = -Math.sin(phase) * 0.5;
      this.armL.rotation.x = -Math.sin(phase) * 0.4;
      this.armR.rotation.x = Math.sin(phase) * 0.4;
    } else {
      this.legL.rotation.x *= 0.9;
      this.legR.rotation.x *= 0.9;
      this.armL.rotation.x *= 0.9;
      this.armR.rotation.x *= 0.9;
    }
  }
}

/** Manager for the villager population. */
export class VillagerManager {
  constructor(scene, half) {
    this.scene = scene;
    this.half = half;
    this.list = [];
  }

  spawn(name) {
    const realName = name ?? NAMES[Math.floor(Math.random() * NAMES.length)];
    const v = new Villager(realName);
    // Spawn at edge so they walk in
    const a = Math.random() * Math.PI * 2;
    v.group.position.set(Math.cos(a) * this.half, 0, Math.sin(a) * this.half);
    this.scene.add(v.group);
    this.list.push(v);
    return v;
  }

  removeAll() {
    for (const v of this.list) this.scene.remove(v.group);
    this.list = [];
  }

  count() {
    return this.list.length;
  }

  update(dt) {
    for (const v of this.list) v.update(dt, this.half);
  }
}
