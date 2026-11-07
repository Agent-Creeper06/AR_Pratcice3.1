// Здесь настраивается всё содержимое: модели, HDRI, цвета.
// Чтобы добавить свою модель, положите .glb в assets/models/ и добавьте запись в MODELS.

export const DEFAULTS = { model: 'cube', environment: 'royal' };

// type 'procedural' — собирается из примитивов (сеть не нужна)
// type 'gltf'       — грузится из urls по очереди: сначала локальный файл, затем запасной адрес
// height — высота объекта в метрах после нормализации
const R160 = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples';

export const MODELS = [
  { id: 'cube',   label: 'Куб',          type: 'procedural', height: 0.2 },
  { id: 'sphere', label: 'Металл. шар',  type: 'procedural', height: 0.2 },
  { id: 'chair',  label: 'Стул',         type: 'procedural', height: 0.9 },
  {
    id: 'armchair', label: 'Кресло (glTF)', type: 'gltf', height: 0.9,
    urls: ['./assets/models/SheenChair.glb', `${R160}/models/gltf/SheenChair.glb`]
  },
  {
    id: 'helmet', label: 'Шлем (glTF)', type: 'gltf', height: 0.3,
    urls: ['./assets/models/helmet.glb', `${R160}/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf`]
  }
];

// procedural: true — встроенная студия (RoomEnvironment), не требует загрузки файла.
// Если .hdr не загрузился, автоматически используется встроенная студия.
export const ENVIRONMENTS = [
  { id: 'room',   label: 'Студия', procedural: true },
  {
    id: 'royal', label: 'Эспланада',
    urls: ['./assets/hdri/royal_esplanade_1k.hdr', `${R160}/textures/equirectangular/royal_esplanade_1k.hdr`]
  },
  {
    id: 'venice', label: 'Закат',
    urls: ['./assets/hdri/venice_sunset_1k.hdr', `${R160}/textures/equirectangular/venice_sunset_1k.hdr`]
  }
];

export const COLORS = [
  { label: 'Красный',    hex: '#e53935' },
  { label: 'Оранжевый',  hex: '#fb8c00' },
  { label: 'Жёлтый',     hex: '#fdd835' },
  { label: 'Зелёный',    hex: '#43a047' },
  { label: 'Синий',      hex: '#1e88e5' },
  { label: 'Фиолетовый', hex: '#8e24aa' },
  { label: 'Белый',      hex: '#ffffff' },
  { label: 'Чёрный',     hex: '#222222' }
];
