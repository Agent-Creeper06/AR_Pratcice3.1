import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createProceduralModel } from './ProceduralModels.js';

// Загрузка моделей и приведение их к единому виду:
// высота = entry.height (м), основание на y = 0, центр по x/z в нуле.
export class ModelLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.gltfCache = new Map();   // id -> исходная сцена glTF
  }

  /** @returns {Promise<{object: THREE.Group, size: THREE.Vector3}>} */
  async load(entry) {
    const source = entry.type === 'gltf'
      ? (await this._getGltfScene(entry)).clone(true)
      : createProceduralModel(entry.id);
    return this._prepare(source, entry.height);
  }

  async _getGltfScene(entry) {
    if (this.gltfCache.has(entry.id)) return this.gltfCache.get(entry.id);

    let lastError = null;
    for (const url of entry.urls ?? []) {
      try {
        const gltf = await this.gltfLoader.loadAsync(url);
        this.gltfCache.set(entry.id, gltf.scene);
        return gltf.scene;
      } catch (e) {
        lastError = e;
        console.warn('Модель не загрузилась:', url, e);
      }
    }
    throw lastError ?? new Error(`Нет адресов для модели «${entry.id}»`);
  }

  _prepare(source, targetHeight) {
    // Свои копии материалов: изменения цвета не затронут кэш
    source.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
    });

    const holder = new THREE.Group();
    holder.add(source);

    // 1) масштаб до нужной высоты
    const height = new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3()).y || 1;
    source.scale.multiplyScalar(targetHeight / height);

    // 2) центр по x/z, основание на полу
    const fitted = new THREE.Box3().setFromObject(source);
    const center = fitted.getCenter(new THREE.Vector3());
    source.position.x -= center.x;
    source.position.y -= fitted.min.y;
    source.position.z -= center.z;

    return { object: holder, size: fitted.getSize(new THREE.Vector3()) };
  }
}
