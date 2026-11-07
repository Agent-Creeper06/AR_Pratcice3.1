import * as THREE from 'three';

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _normal = new THREE.Vector3();

// Маркер-кольцо на найденной поверхности. Показывается только на горизонтальных
// поверхностях (пол, стол), так как мебель ставится «на ножки».
export class Reticle {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;   // матрицу задаёт hit-test
    this.group.visible = false;

    const material = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.16, 40).rotateX(-Math.PI / 2), material);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16).rotateX(-Math.PI / 2), material);
    this.group.add(this.ring, dot);
    scene.add(this.group);
  }

  get visible() { return this.group.visible; }

  setPose(matrixArray) {
    this.group.matrix.fromArray(matrixArray);
    this.group.matrix.decompose(_pos, _quat, _scale);
    _normal.set(0, 1, 0).applyQuaternion(_quat);
    this.group.visible = _normal.y > 0.8;
  }

  hide() { this.group.visible = false; }

  getPosition(target) {
    return target.setFromMatrixPosition(this.group.matrix);
  }

  pulse(timeMs) {
    this.ring.scale.setScalar(1 + 0.08 * Math.sin(timeMs / 180));
  }
}
