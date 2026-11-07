import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// HDRI -> PMREM -> scene.environment.
// Даёт PBR-материалам освещение и отражения. Фон не трогаем: в AR фон — камера.
export class EnvironmentManager {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.hdrLoader = new RGBELoader();
    this.cache = new Map();
    this._room = null;
  }

  /** @returns {Promise<{usedFallback: boolean}>} */
  async set(entry) {
    let cached = this.cache.get(entry.id);
    if (!cached) {
      cached = await this._build(entry);
      this.cache.set(entry.id, cached);
    }
    this.scene.environment = cached.texture;
    this.scene.background = null;
    return { usedFallback: cached.usedFallback };
  }

  async _build(entry) {
    if (!entry.procedural) {
      for (const url of entry.urls ?? []) {
        try {
          const hdr = await this.hdrLoader.loadAsync(url);
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          const texture = this.pmrem.fromEquirectangular(hdr).texture;
          hdr.dispose();
          return { texture, usedFallback: false };
        } catch (e) {
          console.warn('HDRI не загрузился:', url, e);
        }
      }
    }
    // Запасной вариант: встроенная студия без загрузки файлов
    return { texture: this._getRoom(), usedFallback: !entry.procedural };
  }

  _getRoom() {
    if (!this._room) {
      this._room = this.pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    }
    return this._room;
  }
}
