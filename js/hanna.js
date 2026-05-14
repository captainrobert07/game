import * as THREE from "three";

const PALETTE = {
  skin: 0xf5cfa0,
  skinShade: 0xd9a87a,
  hair: 0xc97a2b,
  hairShade: 0x8a4a14,
  dress: 0xff7eb6,
  dressShade: 0xcc4d8a,
  apron: 0xfff3d6,
  belt: 0x6b3e20,
  boots: 0x4a2a16,
  ribbon: 0xffe066,
  eyes: 0x1c1c1c,
  cheek: 0xff8a8a,
};

function mat(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: null });
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, color, x = 0, y = 0, z = 0, segments = 16) {
  const g = new THREE.SphereGeometry(r, segments, segments);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function cylinder(rTop, rBot, h, color, x = 0, y = 0, z = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 12);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * Procedural Clash-of-Clans-style Hanna.
 * Big head, chunky limbs, vibrant palette. Built from primitives so we ship
 * a recognizable character without external assets.
 */
export class Hanna {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Hanna";

    // Body root for vertical bob — keeps feet planted
    this.body = new THREE.Group();
    this.group.add(this.body);

    // ---------- Legs ----------
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    const legGeom = new THREE.BoxGeometry(0.32, 0.55, 0.32);
    const legMatBoots = mat(PALETTE.boots);
    const legMeshL = new THREE.Mesh(legGeom, legMatBoots);
    legMeshL.position.y = -0.275;
    legMeshL.castShadow = true;
    this.legL.add(legMeshL);
    const legMeshR = new THREE.Mesh(legGeom, legMatBoots);
    legMeshR.position.y = -0.275;
    legMeshR.castShadow = true;
    this.legR.add(legMeshR);
    this.legL.position.set(-0.22, 0.55, 0);
    this.legR.position.set(0.22, 0.55, 0);
    this.body.add(this.legL);
    this.body.add(this.legR);

    // ---------- Dress (flared) ----------
    const dressBottom = cylinder(0.55, 0.4, 0.55, PALETTE.dress, 0, 0.85, 0);
    this.body.add(dressBottom);

    // Apron front
    const apron = box(0.55, 0.42, 0.05, PALETTE.apron, 0, 0.85, 0.36);
    this.body.add(apron);

    // Belt
    const belt = cylinder(0.42, 0.42, 0.08, PALETTE.belt, 0, 1.15, 0);
    this.body.add(belt);

    // ---------- Torso ----------
    const torso = box(0.7, 0.5, 0.5, PALETTE.dress, 0, 1.4, 0);
    this.body.add(torso);

    // ---------- Arms ----------
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    const armGeom = new THREE.BoxGeometry(0.24, 0.55, 0.24);
    const armMatSleeve = mat(PALETTE.dress);
    const armMatHand = mat(PALETTE.skin);

    const sleeveL = new THREE.Mesh(armGeom, armMatSleeve);
    sleeveL.position.y = -0.2;
    sleeveL.castShadow = true;
    this.armL.add(sleeveL);
    const handL = sphere(0.15, PALETTE.skin, 0, -0.5, 0, 12);
    this.armL.add(handL);

    const sleeveR = new THREE.Mesh(armGeom, armMatSleeve);
    sleeveR.position.y = -0.2;
    sleeveR.castShadow = true;
    this.armR.add(sleeveR);
    const handR = sphere(0.15, PALETTE.skin, 0, -0.5, 0, 12);
    this.armR.add(handR);

    this.armL.position.set(-0.45, 1.6, 0);
    this.armR.position.set(0.45, 1.6, 0);
    this.body.add(this.armL);
    this.body.add(this.armR);

    // ---------- Neck ----------
    const neck = cylinder(0.14, 0.14, 0.12, PALETTE.skin, 0, 1.72, 0);
    this.body.add(neck);

    // ---------- Head ----------
    this.head = new THREE.Group();
    this.head.position.set(0, 1.95, 0);
    this.body.add(this.head);

    const headBall = sphere(0.42, PALETTE.skin, 0, 0, 0, 24);
    this.head.add(headBall);

    // Cheeks
    this.head.add(sphere(0.06, PALETTE.cheek, -0.28, -0.06, 0.32, 8));
    this.head.add(sphere(0.06, PALETTE.cheek, 0.28, -0.06, 0.32, 8));

    // Eyes — flat ovals so they read at distance
    const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.eyes });
    const eyeGeom = new THREE.SphereGeometry(0.06, 12, 12);
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    eyeL.scale.set(0.7, 1.2, 0.5);
    eyeL.position.set(-0.14, 0.04, 0.38);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;
    this.head.add(eyeL);
    this.head.add(eyeR);

    // Eye highlights
    const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), hiMat);
    hi.position.set(-0.13, 0.07, 0.43);
    this.head.add(hi);
    const hi2 = hi.clone();
    hi2.position.x = 0.15;
    this.head.add(hi2);

    // Smile — small curved torus segment
    const smileGeom = new THREE.TorusGeometry(0.08, 0.018, 6, 12, Math.PI);
    const smile = new THREE.Mesh(smileGeom, eyeMat);
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.12, 0.4);
    this.head.add(smile);

    // ---------- Hair ----------
    // Hair cap covering the top/back of the head
    const hairCap = sphere(0.44, PALETTE.hair, 0, 0.04, -0.02, 24);
    hairCap.scale.set(1, 0.95, 1);
    this.head.add(hairCap);

    // Bangs front
    const bangs = box(0.6, 0.18, 0.18, PALETTE.hair, 0, 0.32, 0.3);
    bangs.rotation.x = -0.2;
    this.head.add(bangs);

    // Side locks
    const sideL = box(0.14, 0.4, 0.18, PALETTE.hair, -0.36, 0.0, 0.1);
    const sideR = box(0.14, 0.4, 0.18, PALETTE.hair, 0.36, 0.0, 0.1);
    this.head.add(sideL);
    this.head.add(sideR);

    // Ponytail (off the back, swings later)
    this.ponytail = new THREE.Group();
    this.ponytail.position.set(0, 0.05, -0.42);
    const tail1 = sphere(0.18, PALETTE.hair, 0, -0.05, -0.04, 12);
    const tail2 = sphere(0.16, PALETTE.hair, 0, -0.22, -0.1, 12);
    const tail3 = sphere(0.13, PALETTE.hair, 0, -0.38, -0.16, 12);
    const tail4 = sphere(0.1, PALETTE.hair, 0, -0.5, -0.22, 12);
    this.ponytail.add(tail1, tail2, tail3, tail4);

    // Ribbon at the base of the ponytail
    const ribbon = box(0.22, 0.08, 0.22, PALETTE.ribbon, 0, 0.02, 0);
    this.ponytail.add(ribbon);

    this.head.add(this.ponytail);

    // ---------- Sun hat (the iconic accessory) ----------
    const hatBrim = cylinder(0.7, 0.7, 0.04, 0xffe066, 0, 0.42, 0);
    this.head.add(hatBrim);
    const hatTop = cylinder(0.32, 0.36, 0.18, 0xffd54a, 0, 0.55, 0);
    this.head.add(hatTop);
    const hatBand = cylinder(0.33, 0.37, 0.06, PALETTE.dressShade, 0, 0.46, 0);
    this.head.add(hatBand);
    // Tiny sunflower on hat
    this.head.add(this._sunflower(0.34, 0.5, 0.34));

    // ---------- Shadow blob (cheap fake AO under feet) ----------
    const shadowGeom = new THREE.CircleGeometry(0.55, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    });
    const shadowDisc = new THREE.Mesh(shadowGeom, shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.01;
    this.group.add(shadowDisc);

    // Animation state
    this.t = 0;
    this.walkPhase = 0;
    this.targetPos = null;
    this.speed = 1.4;
  }

  _sunflower(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const center = sphere(0.04, 0x6b3e20, 0, 0, 0, 8);
    g.add(center);
    const petalMat = mat(0xffe066);
    const petalGeom = new THREE.SphereGeometry(0.04, 8, 8);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Mesh(petalGeom, petalMat);
      p.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0);
      p.scale.set(0.7, 0.7, 0.4);
      g.add(p);
    }
    return g;
  }

  /** Walk toward a target world-space XZ position. */
  walkTo(targetVec3) {
    this.targetPos = targetVec3.clone();
  }

  setPosition(x, z) {
    this.group.position.set(x, 0, z);
  }

  update(dt) {
    this.t += dt;

    // Walk toward target
    let walking = false;
    if (this.targetPos) {
      const dx = this.targetPos.x - this.group.position.x;
      const dz = this.targetPos.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1) {
        const step = Math.min(this.speed * dt, dist);
        const ang = Math.atan2(dx, dz);
        this.group.position.x += Math.sin(ang) * step;
        this.group.position.z += Math.cos(ang) * step;
        // Smooth-rotate toward direction
        const targetRot = ang;
        let diff = targetRot - this.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y += diff * Math.min(1, dt * 8);
        walking = true;
      } else {
        this.targetPos = null;
      }
    }

    // Idle bob
    const bob = walking
      ? Math.abs(Math.sin(this.t * 8)) * 0.05
      : Math.sin(this.t * 2.2) * 0.03;
    this.body.position.y = bob;

    // Walk cycle for legs/arms
    if (walking) {
      this.walkPhase += dt * 9;
      this.legL.rotation.x = Math.sin(this.walkPhase) * 0.6;
      this.legR.rotation.x = -Math.sin(this.walkPhase) * 0.6;
      this.armL.rotation.x = -Math.sin(this.walkPhase) * 0.5;
      this.armR.rotation.x = Math.sin(this.walkPhase) * 0.5;
    } else {
      // Ease back to idle
      this.legL.rotation.x *= 0.9;
      this.legR.rotation.x *= 0.9;
      this.armL.rotation.x *= 0.9;
      this.armR.rotation.x *= 0.9;
      // Subtle breathing on arms
      const sway = Math.sin(this.t * 1.5) * 0.05;
      this.armL.rotation.z = sway;
      this.armR.rotation.z = -sway;
    }

    // Ponytail sway
    this.ponytail.rotation.x = Math.sin(this.t * 4) * 0.1 - 0.1;
    this.ponytail.rotation.z = Math.sin(this.t * 3) * 0.05;

    // Head idle look
    if (!walking) {
      this.head.rotation.y = Math.sin(this.t * 0.7) * 0.15;
    } else {
      this.head.rotation.y *= 0.9;
    }
  }
}
