import { useEffect, useState } from 'react';
import api from '../../services/api';
import type { AuditLog } from '../../types';
import { relativeTime } from '../../utils';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ items: AuditLog[] }>('/admin/audit-logs', { params: { pageSize: 200 } })
      .then(({ data }) => setLogs(data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">لاگ‌های ممیزی</h1>
      {loading ? (
        <div className="flex justify-center py-12"><div className="loader" /></div>
      ) : logs.length === 0 ? (
        <p className="text-center text-gray-500 py-12">لاگی وجود ندارد.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs">
              <tr>
                <th className="p-3">زمان</th>
                <th className="p-3">مدیر</th>
                <th className="p-3">عملیات</th>
                <th className="p-3">هدف</th>
                <th className="p-3">جزئیات</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t dark:border-gray-700">
                  <td className="p-3 text-xs text-gray-500">{relativeTime(log.createdAt)}</td>
                  <td className="p-3">{log.adminName}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{log.details || '-'}</td>
                  <td className="p-3 text-xs">{log.details}</td>
                  <td className="p-3 text-xs text-gray-500" dir="ltr">{log.ipAddress || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
