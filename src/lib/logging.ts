/**
 * Модуль для логування роботи користувача та адміністратора
 * Завдання 3: Забезпечити протоколювання роботи користувача та адміністратора з системою
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  userType: 'user' | 'admin';
  userName: string;
  action: string;
  module: string;
  details: Record<string, unknown>;
  status: 'success' | 'error' | 'pending';
  duration?: number; // мс
}

const LOG_STORAGE_KEY = 'iod_logs';
const MAX_LOGS = 1000; // Максимум логів у localStorage

export const logger = {
  /**
   * Логування дії користувача/адміністратора
   */
  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
    const logEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    try {
      const logs = logger.getAllLogs();
      logs.push(logEntry);

      // Утримуємо лише останні MAX_LOGS записів
      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
      }

      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Помилка збереження логу:', e);
    }

    return logEntry;
  },

  /**
   * Отримати всі логи
   */
  getAllLogs(): LogEntry[] {
    try {
      const data = localStorage.getItem(LOG_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Фільтрування логів за параметрами
   */
  filterLogs(filters: {
    userType?: 'user' | 'admin';
    userName?: string;
    module?: string;
    status?: 'success' | 'error' | 'pending';
    startDate?: Date;
    endDate?: Date;
  }): LogEntry[] {
    let logs = logger.getAllLogs();

    if (filters.userType) {
      logs = logs.filter((l) => l.userType === filters.userType);
    }
    if (filters.userName) {
      logs = logs.filter((l) => l.userName.includes(filters.userName!));
    }
    if (filters.module) {
      logs = logs.filter((l) => l.module === filters.module);
    }
    if (filters.status) {
      logs = logs.filter((l) => l.status === filters.status);
    }
    if (filters.startDate) {
      const start = filters.startDate.getTime();
      logs = logs.filter((l) => new Date(l.timestamp).getTime() >= start);
    }
    if (filters.endDate) {
      const end = filters.endDate.getTime();
      logs = logs.filter((l) => new Date(l.timestamp).getTime() <= end);
    }

    return logs;
  },

  /**
   * Очистити всі логи
   */
  clearLogs(): void {
    try {
      localStorage.removeItem(LOG_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },

  /**
   * Експортувати логи у JSON
   */
  exportLogs(filename = `logs_${Date.now()}.json`): void {
    const logs = logger.getAllLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /**
   * Експортувати логи у CSV
   */
  exportLogsCSV(filename = `logs_${Date.now()}.csv`): void {
    const logs = logger.getAllLogs();
    const headers = ['ID', 'Час', 'Тип', 'Користувач', 'Дія', 'Модуль', 'Статус', 'Тривалість (мс)'];
    const rows = logs.map((l) => [
      l.id,
      l.timestamp,
      l.userType,
      l.userName,
      l.action,
      l.module,
      l.status,
      l.duration ?? '',
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach((row) => {
      csv += row.map((cell) => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

