import * as THREE from 'three';

// Все материалы — PBR (MeshStandardMaterial): color + roughness + metalness.

const pbr = (color, roughness, metalness) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

const builders = {
  cube() {
    const g = new THREE.Group();
    g.add(box(0.2, 0.2, 0.2, 0, 0.1, 0, pbr(0x3aa0ff, 0.35, 0.1)));
    return g;
  },

  // Полированный металл (metalness 1, roughness 0.15) — лучше всего показывает HDRI
  sphere() {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 48, 32), pbr(0xd0d4da, 0.15, 1.0));
    mesh.position.y = 0.1;
    g.add(mesh);
    return g;
  },

  chair() {
    const g = new THREE.Group();
    const wood = pbr(0x8b5a2b, 0.7, 0.0);
    g.add(box(0.40, 0.04, 0.40, 0, 0.45, 0, wood));        // сиденье
    g.add(box(0.40, 0.40, 0.04, 0, 0.67, -0.18, wood));    // спинка (перед смотрит в +Z)
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([x, z]) => {
      g.add(box(0.04, 0.43, 0.04, x, 0.215, z, wood));     // ножки
    });
    return g;
  }
};

export function createProceduralModel(id) {
  const build = builders[id];
  if (!build) throw new Error(`Нет процедурной модели «${id}»`);
  return build();
}
