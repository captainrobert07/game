import * as THREE from "three";

/**
 * Hanna — procedural 3D character matching the teal-haired reference avatar.
 * Stylized chunky proportions, expressive face, supports run/jump/slide/hit
 * animations for the endless runner.
 */

const PALETTE = {
  skin: 0xf2c8a0,
  skinShade: 0xd9a87a,
  freckle: 0xb8794a,
  hair: 0x2bbfb3, // teal
  hairShade: 0x1a8a82,
  hairHighlight: 0x4fd9cd,
  brow: 0x1a8a82,
  iris: 0x2bbfb3,
  sclera: 0xffffff,
  pupil: 0x081818,
  lashes: 0x141414,
  lipUpper: 0xc97a82,
  lipLower: 0xe89aa0,
  cheek: 0xff9aa6,
  shirt: 0x8aa898, // sage / dusty green
  shirtShade: 0x6a8a78,
  pants: 0x3a4a6a, // dark indigo
  shoes: 0x2a2a2a,
  gold: 0xf5c84a,
  goldDark: 0xb88a1a,
  choker: 0x141414,
};

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}
function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}
function sphere(r, mat, segs = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), mat);
  m.castShadow = true;
  return m;
}
function cyl(rTop, rBot, h, mat, segs = 12) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, segs),
    mat
  );
  m.castShadow = true;
  return m;
}

export class Hanna {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Hanna";

    // Root that we bob — keeps feet planted
    this.body = new THREE.Group();
    this.group.add(this.body);

    this._buildLegs();
    this._buildTorso();
    this._buildArms();
    this._buildNeckHead();
    this._buildHair();
    this._buildShadow();

    this.t = 0;
    this.state = "run"; // run | jump | slide | hit | idle
    this.prevState = "run";
    this.stateTime = 0;
    this._shieldActive = false;
    this._doubleActive = false;
  }

  // ---------- Build ----------
  _buildLegs() {
    const skinMat = toon(PALETTE.skin);
    const pantsMat = toon(PALETTE.pants);
    const shoesMat = toon(PALETTE.shoes);

    this.legL = new THREE.Group();
    this.legR = new THREE.Group();

    // Pants leg + foot per side
    const mkLeg = () => {
      const g = new THREE.Group();
      const thigh = box(0.28, 0.55, 0.28, pantsMat);
      thigh.position.y = -0.25;
      g.add(thigh);
      const shin = box(0.24, 0.05, 0.24, skinMat);
      shin.position.y = -0.55;
      g.add(shin);
      const shoe = box(0.3, 0.18, 0.42, shoesMat);
      shoe.position.set(0, -0.65, 0.06);
      g.add(shoe);
      return g;
    };

    this.legL.add(mkLeg());
    this.legR.add(mkLeg());
    this.legL.position.set(-0.18, 0.85, 0);
    this.legR.position.set(0.18, 0.85, 0);
    this.body.add(this.legL, this.legR);
  }

  _buildTorso() {
    const shirtMat = toon(PALETTE.shirt);
    const skinMat = toon(PALETTE.skin);

    // Chunky torso with a rounded neckline
    this.torso = new THREE.Group();
    this.body.add(this.torso);
    this.torso.position.y = 1.3;

    const tor = box(0.7, 0.55, 0.45, shirtMat);
    this.torso.add(tor);

    // Hint of waist taper using a smaller box on top
    const upper = box(0.6, 0.2, 0.42, shirtMat);
    upper.position.y = 0.35;
    this.torso.add(upper);

    // Neckline cut — small skin patch where the shirt opens
    const neckline = box(0.22, 0.1, 0.05, skinMat);
    neckline.position.set(0, 0.4, 0.22);
    this.torso.add(neckline);

    // Choker (thin black ring)
    const choker = cyl(0.18, 0.18, 0.06, toon(PALETTE.choker), 16);
    choker.position.y = 0.5;
    this.torso.add(choker);

    // Gold pendant on a thin chain
    const chainL = cyl(0.005, 0.005, 0.18, toon(PALETTE.gold), 6);
    chainL.position.set(-0.05, 0.42, 0.18);
    chainL.rotation.z = -0.3;
    this.torso.add(chainL);
    const chainR = chainL.clone();
    chainR.position.x = 0.05;
    chainR.rotation.z = 0.3;
    this.torso.add(chainR);

    const pendant = sphere(0.05, toon(PALETTE.gold), 12);
    pendant.scale.set(1, 1.4, 0.8);
    pendant.position.set(0, 0.32, 0.22);
    this.torso.add(pendant);
  }

  _buildArms() {
    const shirtMat = toon(PALETTE.shirt);
    const skinMat = toon(PALETTE.skin);

    this.armL = new THREE.Group();
    this.armR = new THREE.Group();

    const mkArm = () => {
      const g = new THREE.Group();
      // Sleeve (long sleeve, sage)
      const sleeve = box(0.2, 0.45, 0.2, shirtMat);
      sleeve.position.y = -0.22;
      g.add(sleeve);
      // Forearm (skin showing past the sleeve)
      const forearm = cyl(0.08, 0.085, 0.25, skinMat, 10);
      forearm.position.y = -0.55;
      g.add(forearm);
      // Hand
      const hand = sphere(0.11, skinMat, 12);
      hand.position.y = -0.7;
      hand.scale.set(1, 1.1, 0.9);
      g.add(hand);
      return g;
    };

    this.armL.add(mkArm());
    this.armR.add(mkArm());
    this.armL.position.set(-0.45, 1.6, 0);
    this.armR.position.set(0.45, 1.6, 0);
    this.body.add(this.armL, this.armR);
  }

  _buildNeckHead() {
    const skinMat = toon(PALETTE.skin);

    // Neck
    const neck = cyl(0.12, 0.12, 0.14, skinMat, 12);
    neck.position.y = 1.78;
    this.body.add(neck);

    // Head root
    this.head = new THREE.Group();
    this.head.position.set(0, 2.05, 0);
    this.body.add(this.head);

    // Skull — slightly squished sphere for the rounded stylized look
    const skull = sphere(0.5, skinMat, 24);
    skull.scale.set(1.0, 1.05, 0.95);
    this.head.add(skull);

    // Chin — tiny bevel
    const chin = sphere(0.18, skinMat, 12);
    chin.position.set(0, -0.38, 0.12);
    chin.scale.set(1.2, 0.6, 0.8);
    this.head.add(chin);

    this._buildFace();
    this._buildEars();
  }

  _buildFace() {
    // Eyes — big, bright. White sclera + teal iris + black pupil + highlight + lashes.
    const eyeGroup = new THREE.Group();
    this.head.add(eyeGroup);
    eyeGroup.position.set(0, 0.02, 0.42);

    const mkEye = (xSign) => {
      const g = new THREE.Group();
      g.position.set(0.16 * xSign, 0, 0);

      // Sclera (white)
      const sclera = sphere(0.105, basic(PALETTE.sclera), 16);
      sclera.scale.set(0.9, 1.05, 0.5);
      g.add(sclera);

      // Iris (teal)
      const iris = sphere(0.075, basic(PALETTE.iris), 14);
      iris.scale.set(0.9, 1.0, 0.3);
      iris.position.z = 0.04;
      g.add(iris);

      // Pupil
      const pupil = sphere(0.038, basic(PALETTE.pupil), 12);
      pupil.scale.set(0.9, 1.0, 0.3);
      pupil.position.z = 0.06;
      g.add(pupil);

      // Highlight (top)
      const hi = sphere(0.022, basic(0xffffff), 8);
      hi.position.set(-0.025 * xSign, 0.04, 0.075);
      g.add(hi);
      const hi2 = sphere(0.012, basic(0xffffff), 8);
      hi2.position.set(0.03 * xSign, -0.025, 0.075);
      g.add(hi2);

      // Upper lash — thin curved bar above the eye
      const lash = box(0.18, 0.02, 0.04, basic(PALETTE.lashes));
      lash.position.set(0, 0.085, 0.02);
      lash.rotation.z = -0.05 * xSign;
      g.add(lash);

      // Lower lash hint
      const lashB = box(0.14, 0.012, 0.04, basic(PALETTE.lashes));
      lashB.position.set(0, -0.075, 0.02);
      g.add(lashB);

      return g;
    };

    this.eyeL = mkEye(-1);
    this.eyeR = mkEye(1);
    eyeGroup.add(this.eyeL, this.eyeR);

    // Eyebrows — teal (matching hair)
    const browMat = toon(PALETTE.brow);
    const browL = box(0.16, 0.04, 0.05, browMat);
    browL.position.set(-0.16, 0.18, 0.42);
    browL.rotation.z = 0.05;
    this.head.add(browL);
    const browR = browL.clone();
    browR.position.x = 0.16;
    browR.rotation.z = -0.05;
    this.head.add(browR);

    // Nose — small button
    const nose = sphere(0.05, toon(PALETTE.skinShade), 12);
    nose.position.set(0, -0.05, 0.49);
    nose.scale.set(1.0, 0.9, 0.9);
    this.head.add(nose);

    // Cheeks — soft pink blush
    const cheekMat = new THREE.MeshBasicMaterial({
      color: PALETTE.cheek,
      transparent: true,
      opacity: 0.55,
    });
    const cheekL = sphere(0.09, cheekMat, 12);
    cheekL.scale.set(1, 0.7, 0.3);
    cheekL.position.set(-0.22, -0.08, 0.42);
    this.head.add(cheekL);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.22;
    this.head.add(cheekR);

    // Freckles — tiny dots across nose / upper cheeks
    const freckleMat = basic(PALETTE.freckle);
    const freckleGeom = new THREE.SphereGeometry(0.012, 6, 6);
    const frecklePositions = [
      [-0.18, -0.04, 0.46], [-0.13, -0.02, 0.48], [-0.07, -0.06, 0.49],
      [0.07, -0.06, 0.49], [0.13, -0.02, 0.48], [0.18, -0.04, 0.46],
      [-0.10, 0.02, 0.48], [0.10, 0.02, 0.48],
      [-0.20, -0.10, 0.43], [0.20, -0.10, 0.43],
    ];
    for (const [x, y, z] of frecklePositions) {
      const f = new THREE.Mesh(freckleGeom, freckleMat);
      f.position.set(x, y, z);
      this.head.add(f);
    }

    // Lips — gentle smile, two tones
    const upperLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI),
      toon(PALETTE.lipUpper)
    );
    upperLip.rotation.z = Math.PI;
    upperLip.position.set(0, -0.21, 0.46);
    this.head.add(upperLip);

    const lowerLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.022, 6, 12, Math.PI),
      toon(PALETTE.lipLower)
    );
    lowerLip.position.set(0, -0.235, 0.46);
    this.head.add(lowerLip);
  }

  _buildEars() {
    const skinMat = toon(PALETTE.skin);
    const goldMat = toon(PALETTE.gold);

    const earL = sphere(0.08, skinMat, 10);
    earL.scale.set(0.6, 1.1, 0.4);
    earL.position.set(-0.48, -0.02, 0.05);
    this.head.add(earL);

    const earR = earL.clone();
    earR.position.x = 0.48;
    this.head.add(earR);

    // Gold hoops
    const hoopGeom = new THREE.TorusGeometry(0.05, 0.012, 6, 16);
    const hoopL = new THREE.Mesh(hoopGeom, goldMat);
    hoopL.position.set(-0.5, -0.12, 0.05);
    hoopL.rotation.y = Math.PI / 2;
    this.head.add(hoopL);
    const hoopR = hoopL.clone();
    hoopR.position.x = 0.5;
    this.head.add(hoopR);
  }

  _buildHair() {
    const hairMat = toon(PALETTE.hair);
    const hairShade = toon(PALETTE.hairShade);
    const hairHi = toon(PALETTE.hairHighlight);

    // Hair root (so we can flop it during anim)
    this.hair = new THREE.Group();
    this.head.add(this.hair);

    // Skull cap (covers crown + back)
    const cap = sphere(0.54, hairMat, 24);
    cap.scale.set(1.04, 1.05, 1.05);
    cap.position.set(0, 0.05, -0.04);
    this.hair.add(cap);

    // Asymmetric long bangs swept across forehead
    const bang1 = box(0.55, 0.18, 0.22, hairMat);
    bang1.position.set(-0.05, 0.32, 0.32);
    bang1.rotation.x = -0.2;
    bang1.rotation.z = -0.15;
    this.hair.add(bang1);

    const bang2 = box(0.35, 0.14, 0.18, hairShade);
    bang2.position.set(0.18, 0.3, 0.36);
    bang2.rotation.x = -0.25;
    bang2.rotation.z = 0.2;
    this.hair.add(bang2);

    // Side locks falling past the cheeks (the layered bob shape)
    const sideL = new THREE.Group();
    const sl1 = box(0.18, 0.55, 0.2, hairMat);
    sl1.position.set(0, -0.2, 0);
    sideL.add(sl1);
    // Curl tip
    const slTip = sphere(0.13, hairShade, 12);
    slTip.position.set(0.04, -0.5, 0.05);
    slTip.scale.set(0.9, 1.1, 0.9);
    sideL.add(slTip);
    sideL.position.set(-0.4, 0.05, 0.1);
    sideL.rotation.z = -0.08;
    this.hair.add(sideL);

    const sideR = new THREE.Group();
    const sr1 = box(0.18, 0.55, 0.2, hairMat);
    sr1.position.set(0, -0.2, 0);
    sideR.add(sr1);
    const srTip = sphere(0.13, hairShade, 12);
    srTip.position.set(-0.04, -0.5, 0.05);
    srTip.scale.set(0.9, 1.1, 0.9);
    sideR.add(srTip);
    sideR.position.set(0.4, 0.05, 0.1);
    sideR.rotation.z = 0.08;
    this.hair.add(sideR);

    this.sideHairL = sideL;
    this.sideHairR = sideR;

    // Back hair — slightly longer mass
    const back = box(0.6, 0.5, 0.22, hairShade);
    back.position.set(0, -0.05, -0.32);
    this.hair.add(back);

    // Highlight strands
    const hi1 = box(0.06, 0.5, 0.08, hairHi);
    hi1.position.set(-0.25, 0, 0.3);
    hi1.rotation.z = -0.15;
    this.hair.add(hi1);
    const hi2 = box(0.04, 0.4, 0.08, hairHi);
    hi2.position.set(0.18, 0.05, 0.32);
    hi2.rotation.z = 0.12;
    this.hair.add(hi2);
  }

  _buildShadow() {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.shadow = shadow;
    this.group.add(shadow);

    // Shield aura — visible when active, controlled by setShield()
    this.shieldAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0x55aaff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.shieldAura.position.y = 1.1;
    this.body.add(this.shieldAura);

    // Double-points sparkle ring (ground-aligned)
    this.doubleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 6, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff66ff,
        transparent: true,
        opacity: 0,
      })
    );
    this.doubleRing.rotation.x = -Math.PI / 2;
    this.doubleRing.position.y = 0.02;
    this.group.add(this.doubleRing);
  }

  setShield(active) {
    this._shieldActive = active;
  }
  setDouble(active) {
    this._doubleActive = active;
  }

  // ---------- Animation states ----------
  setState(s) {
    if (s === this.state) return;
    this.prevState = this.state;
    this.state = s;
    this.stateTime = 0;
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  update(dt) {
    this.t += dt;
    this.stateTime += dt;

    if (this.state === "run") this._animRun(dt);
    else if (this.state === "jump") this._animJump(dt);
    else if (this.state === "slide") this._animSlide(dt);
    else if (this.state === "hit") this._animHit(dt);
    else this._animIdle(dt);

    // Aura visibility (set by game.js each frame)
    const targetShield = this._shieldActive ? 0.25 + Math.sin(this.t * 6) * 0.05 : 0;
    this.shieldAura.material.opacity += (targetShield - this.shieldAura.material.opacity) * 0.2;
    const targetDouble = this._doubleActive ? 0.7 + Math.sin(this.t * 8) * 0.2 : 0;
    this.doubleRing.material.opacity += (targetDouble - this.doubleRing.material.opacity) * 0.2;
    this.doubleRing.scale.setScalar(1 + Math.sin(this.t * 6) * 0.08);

    // Hair sway — bigger when running
    const swayMul = this.state === "run" ? 2.5 : 1.0;
    this.sideHairL.rotation.x = Math.sin(this.t * 8) * 0.08 * swayMul;
    this.sideHairR.rotation.x = Math.sin(this.t * 8 + 0.5) * 0.08 * swayMul;
    // Hair group tilts slightly back when running (wind)
    if (this.state === "run") {
      this.hair.rotation.x = -0.08;
    } else {
      this.hair.rotation.x *= 0.9;
    }
  }

  _animIdle(dt) {
    const bob = Math.sin(this.t * 2) * 0.03;
    this.body.position.y = bob;
    // Ease arms/legs back to neutral
    this._easeRot(this.armL, 0, 0, 0, 0.9);
    this._easeRot(this.armR, 0, 0, 0, 0.9);
    this._easeRot(this.legL, 0, 0, 0, 0.9);
    this._easeRot(this.legR, 0, 0, 0, 0.9);
    this.body.rotation.x = 0;
  }

  _animRun(dt) {
    // Fast pumping run cycle
    const phase = this.t * 12;
    this.legL.rotation.x = Math.sin(phase) * 0.9;
    this.legR.rotation.x = -Math.sin(phase) * 0.9;
    this.armL.rotation.x = -Math.sin(phase) * 0.8;
    this.armR.rotation.x = Math.sin(phase) * 0.8;
    // Subtle torso lean forward
    this.body.rotation.x = 0.08;
    // Vertical bounce
    this.body.position.y = Math.abs(Math.sin(phase)) * 0.06;
  }

  _animJump(dt) {
    // Tucked legs, arms up. The Y position is set by game loop (gravity).
    const tuck = Math.min(1, this.stateTime * 6);
    this.legL.rotation.x = -0.6 * tuck;
    this.legR.rotation.x = -0.6 * tuck;
    this.armL.rotation.x = -1.6 * tuck;
    this.armR.rotation.x = -1.6 * tuck;
    this.body.rotation.x = 0;
    this.body.position.y = 0;
  }

  _animSlide(dt) {
    // Body tilts back, legs forward. Game loop also lowers the whole group.
    const t = Math.min(1, this.stateTime * 6);
    this.body.rotation.x = -0.9 * t;
    this.legL.rotation.x = 1.2 * t;
    this.legR.rotation.x = 1.2 * t;
    this.armL.rotation.x = 0.4 * t;
    this.armR.rotation.x = 0.4 * t;
    this.body.position.y = -0.2 * t;
  }

  _animHit(dt) {
    // Knockback wobble
    const t = this.stateTime;
    this.body.rotation.x = -0.4 * Math.sin(t * 14);
    this.body.rotation.z = 0.2 * Math.sin(t * 10);
    this.armL.rotation.x = -1.3;
    this.armR.rotation.x = -1.3;
    this.legL.rotation.x = 0.4;
    this.legR.rotation.x = -0.4;
  }

  _easeRot(obj, x, y, z, factor) {
    obj.rotation.x = obj.rotation.x * factor + x * (1 - factor);
    obj.rotation.y = obj.rotation.y * factor + y * (1 - factor);
    obj.rotation.z = obj.rotation.z * factor + z * (1 - factor);
  }
}
