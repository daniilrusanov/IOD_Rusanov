/**
 * Модуль конфігурації системи
 * Завдання 1: Забезпечити гнучке налаштування предметної області та архівування даних
 */

export interface SystemConfig {
  // Предметна область
  domainName: string;
  objectCount: number;
  expertMinCount: number;
  expertMaxCount: number;
  selectionSize: number; // Кількість об'єктів, які експерт обирає (ЛР1)

  // Параметри ЛР2
  heuristicsMin: number;
  heuristicsMax: number;

  // Параметри ЛР3/ЛР4 - максимум об'єктів для перебору
  bruteForceMaxN: number;

  // Параметри еволюційного алгоритму
  gaPopulationSize: number;
  gaGenerations: number;
  gaMutationRate: number;

  // Режими роботи
  confidentialMode: boolean; // Анонімність
  openMode: boolean; // Відкритість результатів

  // Збереження даних
  autoArchiveInterval: number; // мінути
  maxStoredArchives: number;
}

export interface DomainObject {
  id: number;
  name: string;
  description?: string;
  category?: string;
}

const CONFIG_STORAGE_KEY = 'iod_system_config';
const DOMAIN_STORAGE_KEY = 'iod_domain_objects';

const DEFAULT_CONFIG: SystemConfig = {
  domainName: 'Мультфільми для формування треку',
  objectCount: 20,
  expertMinCount: 10,
  expertMaxCount: 100,
  selectionSize: 3,
  heuristicsMin: 2,
  heuristicsMax: 3,
  bruteForceMaxN: 10,
  gaPopulationSize: 180,
  gaGenerations: 500,
  gaMutationRate: 0.18,
  confidentialMode: true,
  openMode: false,
  autoArchiveInterval: 30,
  maxStoredArchives: 10,
};

export const configManager = {
  /**
   * Отримати поточну конфігурацію
   */
  getConfig(): SystemConfig {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  /**
   * Оновити конфігурацію
   */
  updateConfig(updates: Partial<SystemConfig>): SystemConfig {
    const current = configManager.getConfig();
    const updated = { ...current, ...updates };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Помилка збереження конфігурації:', e);
    }
    return updated;
  },

  /**
   * Скинути конфігурацію на значення за замовчуванням
   */
  resetConfig(): SystemConfig {
    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return DEFAULT_CONFIG;
  },

  /**
   * Отримати конфігурацію за замовчуванням
   */
  getDefaultConfig(): SystemConfig {
    return { ...DEFAULT_CONFIG };
  },

  /**
   * Експортувати конфігурацію
   */
  exportConfig(filename = `config_${Date.now()}.json`): void {
    const config = configManager.getConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /**
   * Імпортувати конфігурацію з JSON
   */
  importConfig(jsonText: string): boolean {
    try {
      const imported = JSON.parse(jsonText);
      configManager.updateConfig(imported);
      return true;
    } catch (e) {
      console.error('Помилка імпорту конфігурації:', e);
      return false;
    }
  },
};

/**
 * Менеджер об'єктів предметної області
 */
export const domainManager = {
  /**
   * Отримати всі об'єкти
   */
  getObjects(): DomainObject[] {
    try {
      const stored = localStorage.getItem(DOMAIN_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  /**
   * Додати об'єкт
   */
  addObject(obj: DomainObject): void {
    const objects = domainManager.getObjects();
    const exists = objects.some((o) => o.id === obj.id);
    if (!exists) {
      objects.push(obj);
      try {
        localStorage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify(objects));
      } catch (e) {
        console.error('Помилка збереження об\'єкта:', e);
      }
    }
  },

  /**
   * Оновити об'єкт
   */
  updateObject(id: number, updates: Partial<DomainObject>): void {
    let objects = domainManager.getObjects();
    objects = objects.map((o) => (o.id === id ? { ...o, ...updates } : o));
    try {
      localStorage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify(objects));
    } catch (e) {
      console.error('Помилка оновлення об\'єкта:', e);
    }
  },

  /**
   * Видалити об'єкт
   */
  deleteObject(id: number): void {
    const objects = domainManager.getObjects().filter((o) => o.id !== id);
    try {
      localStorage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify(objects));
    } catch (e) {
      console.error('Помилка видалення об\'єкта:', e);
    }
  },

  /**
   * Очистити всі об'єкти
   */
  clearObjects(): void {
    try {
      localStorage.removeItem(DOMAIN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },

  /**
   * Експортувати об'єкти
   */
  exportObjects(filename = `objects_${Date.now()}.json`): void {
    const objects = domainManager.getObjects();
    const blob = new Blob([JSON.stringify(objects, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

