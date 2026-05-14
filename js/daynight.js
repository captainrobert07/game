import * as THREE from "three";

/**
 * Time of day controller. Drives sun position, sky color, and ambient light.
 *
 * One in-game day = `dayLengthSec` real seconds (default 120s = 2 min).
 * `dayCount` advances each full cycle so gameplay can hook in.
 */
export class DayNight {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.dayLengthSec = opts.dayLengthSec ?? 120;
    this.t = 0.25; // start at morning (0=midnight, 0.25=sunrise)
    this.dayCount = 1;

    // Sun
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -25;
    this.sun.shadow.camera.right = 25;
    this.sun.shadow.camera.top = 25;
    this.sun.shadow.camera.bottom = -25;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 80;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Visible sun disc
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe066 })
    );
    scene.add(this.sunDisc);

    // Moon disc
    this.moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xeaeaff })
    );
    scene.add(this.moonDisc);

    // Ambient + hemisphere
    this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xb0e2ff, 0x4a7a3a, 0.5);
    scene.add(this.hemi);

    this.skyColor = new THREE.Color();
    this._update(0);
  }

  // Color helpers
  _lerpColor(a, b, t, out) {
    out.r = a.r + (b.r - a.r) * t;
    out.g = a.g + (b.g - a.g) * t;
    out.b = a.b + (b.b - a.b) * t;
    return out;
  }

  _skyForT(t) {
    const dawn = new THREE.Color(0xff9b6b);
    const day = new THREE.Color(0x9fd6ff);
    const dusk = new THREE.Color(0xff7e6b);
    const night = new THREE.Color(0x0a1430);
    const out = new THREE.Color();
    if (t < 0.25) {
      // Night -> dawn
      this._lerpColor(night, dawn, t / 0.25, out);
    } else if (t < 0.45) {
      this._lerpColor(dawn, day, (t - 0.25) / 0.2, out);
    } else if (t < 0.7) {
      out.copy(day);
    } else if (t < 0.85) {
      this._lerpColor(day, dusk, (t - 0.7) / 0.15, out);
    } else {
      this._lerpColor(dusk, night, (t - 0.85) / 0.15, out);
    }
    return out;
  }

  _update(dt) {
    this.t += dt / this.dayLengthSec;
    while (this.t >= 1) {
      this.t -= 1;
      this.dayCount += 1;
    }

    // Sun angle: noon at t=0.5
    const sunAngle = (this.t - 0.25) * Math.PI * 2; // -π/2 at midnight, π/2 at noon-ish
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);
    const SUN_DIST = 30;
    this.sun.position.set(sunX * SUN_DIST, Math.max(sunY, -0.3) * SUN_DIST, 8);
    this.sunDisc.position.copy(this.sun.position);

    // Moon opposite to sun
    this.moonDisc.position.set(-sunX * SUN_DIST, -sunY * SUN_DIST, 8);

    // Sun intensity falls off as it dips
    const dayness = Math.max(0, sunY);
    this.sun.intensity = 0.2 + dayness * 1.0;
    this.sun.color.setHSL(0.12, 0.4, 0.55 + dayness * 0.35);
    this.sunDisc.visible = sunY > -0.1;
    this.moonDisc.visible = sunY < 0.1;

    this.ambient.intensity = 0.25 + dayness * 0.35;
    this.hemi.intensity = 0.3 + dayness * 0.4;

    // Sky
    const sky = this._skyForT(this.t);
    this.skyColor.copy(sky);
    this.scene.background = this.skyColor;
    if (this.scene.fog) this.scene.fog.color.copy(sky);
  }

  /** Returns true if a new day just started (for one-shot tick events). */
  step(dt) {
    const prevDay = this.dayCount;
    this._update(dt);
    return this.dayCount !== prevDay;
  }

  serialize() {
    return { t: this.t, dayCount: this.dayCount };
  }

  deserialize(s) {
    if (typeof s.t === "number") this.t = s.t;
    if (typeof s.dayCount === "number") this.dayCount = s.dayCount;
  }
}
