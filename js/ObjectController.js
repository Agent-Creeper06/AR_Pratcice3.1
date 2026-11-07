import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

// Один активный объект в сцене: размещение, поворот, цвет, PBR-параметры, замена модели.
// root (позиция, поворот, размер) -> [shadow, model]. Объект добавлен в scene, а не в камеру,
// поэтому при движении устройства остаётся на месте.
export class ObjectController {
  constructor({ scene, modelLoader }) {
    this.loader = modelLoader;

    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);

    this.shadow = this._makeShadow();
    this.root.add(this.shadow);

    this.model = null;
    this.entry = null;
    this.materials = [];
    this.originals = new Map();   // материал -> исходные color/roughness/metalness

    this.isPlaced = false;
    this.autoSpin = false;
    this.spinSpeed = 1.0;         // рад/с
    this._token = 0;
  }

  // ---------- модель ----------

  /** Заменяет модель, сохраняя позицию и поворот. Возвращает значения PBR для ползунков. */
  async setModel(entry) {
    const token = ++this._token;
    const { object, size } = await this.loader.load(entry);

    if (token !== this._token) {          // пока грузилась, выбрали другую
      this._disposeMaterials(object);
      return null;
    }

    this._removeModel();
    this.model = object;
    this.entry = entry;
    this.root.add(object);
    this._collectMaterials(object);
    this.shadow.scale.setScalar(Math.max(size.x, size.z) * 2.2);
    return this.getMaterialSnapshot();
  }

  _removeModel() {
    if (!this.model) return;
    this.root.remove(this.model);
    this._disposeMaterials(this.model);
    this.model = null;
    this.materials = [];
    this.originals.clear();
  }

  _collectMaterials(object) {
    this.materials = [];
    this.originals.clear();
    object.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (this.originals.has(m)) continue;
        this.materials.push(m);
        this.originals.set(m, {
          color: m.color ? m.color.clone() : null,
          roughness: m.roughness,
          metalness: m.metalness
        });
      }
    });
  }

  _disposeMaterials(object) {
    // Геометрию и текстуры не трогаем: они общие с кэшем
    object.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }

  // ---------- размещение ----------

  placeAt(position, lookAtPosition) {
    this.root.position.copy(position);
    if (!this.isPlaced) {
      // при первом размещении повернуть лицом к пользователю
      this.root.rotation.y = Math.atan2(
        lookAtPosition.x - position.x,
        lookAtPosition.z - position.z
      );
      this.isPlaced = true;
    }
    this.root.visible = true;
  }

  clear() {
    this.root.visible = false;
    this.root.rotation.y = 0;
    this.root.scale.setScalar(1);
    this.isPlaced = false;
    this.autoSpin = false;
  }

  // ---------- вращение и размер ----------

  rotateBy(deg) { this.root.rotation.y += deg * DEG2RAD; }
  setYaw(deg) { this.root.rotation.y = deg * DEG2RAD; }
  getYawDeg() {
    const deg = (this.root.rotation.y / DEG2RAD) % 360;
    return Math.round((deg + 360) % 360);
  }
  setAutoSpin(on) { this.autoSpin = on; }
  setScale(s) { this.root.scale.setScalar(s); }

  update(dt) {
    if (this.autoSpin && this.root.visible) this.root.rotation.y += this.spinSpeed * dt;
  }

  // ---------- материал ----------

  /** hex — строка '#rrggbb'; null — вернуть исходный цвет */
  setColor(hex) {
    for (const m of this.materials) {
      if (!m.color) continue;
      if (hex) m.color.set(hex);
      else m.color.copy(this.originals.get(m).color);
    }
  }

  setRoughness(v) {
    for (const m of this.materials) if ('roughness' in m) m.roughness = v;
  }

  setMetalness(v) {
    for (const m of this.materials) if ('metalness' in m) m.metalness = v;
  }

  resetMaterials() {
    for (const m of this.materials) {
      const o = this.originals.get(m);
      if (m.color && o.color) m.color.copy(o.color);
      if ('roughness' in m) m.roughness = o.roughness;
      if ('metalness' in m) m.metalness = o.metalness;
    }
    return this.getMaterialSnapshot();
  }

  getMaterialSnapshot() {
    const m = this.materials.find((x) => 'roughness' in x);
    return { roughness: m?.roughness ?? 0.5, metalness: m?.metalness ?? 0 };
  }

  // ---------- мягкая тень под объектом ----------

  _makeShadow() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false })
    );
    mesh.position.y = 0.002;
    return mesh;
  }
}
