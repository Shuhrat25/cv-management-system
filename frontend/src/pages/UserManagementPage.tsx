import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { TableToolbar } from '../components/TableToolbar';
import { OptimisticLockingBanner } from '../components/OptimisticLockingBanner';
import { Shield, Users, Lock, Unlock, Trash2, UserCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  location: string;
  isBlocked: boolean;
  version: number;
  createdAt: string;
  _count: { cvs: number; positions: number; projects: number };
}

export const UserManagementPage: React.FC = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const { t } = useThemeLanguage();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<UserItem[]>('/users');
      setUsers(data);
      setConflictError(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleBlock = async () => {
    if (!selectedId) return;
    const targetUser = users.find((u) => u.id === selectedId);
    if (!targetUser) return;

    try {
      await apiRequest(`/users/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify({
          isBlocked: !targetUser.isBlocked,
          version: targetUser.version,
        }),
      });
      setSelectedId(null);
      fetchUsers();
    } catch (err: any) {
      if (err.currentVersion !== undefined) {
        setConflictError(err.error || 'Optimistic locking conflict on user update.');
      } else {
        alert(err.error || 'Failed to update user block status');
      }
    }
  };

  const handleChangeRole = async (newRole: string) => {
    if (!selectedId) return;
    const targetUser = users.find((u) => u.id === selectedId);
    if (!targetUser) return;

    if (targetUser.id === currentUser?.id && newRole !== 'ADMIN') {
      if (!confirm('Warning: You are removing your own Administrator role. Proceed?')) return;
    }

    try {
      await apiRequest(`/users/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify({
          role: newRole,
          version: targetUser.version,
        }),
      });
      setSelectedId(null);
      refreshUser();
      fetchUsers();
    } catch (err: any) {
      if (err.currentVersion !== undefined) {
        setConflictError(err.error || 'Optimistic locking conflict on role change.');
      } else {
        alert(err.error || 'Failed to change user role');
      }
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedId) return;
    const targetUser = users.find((u) => u.id === selectedId);
    if (!targetUser) return;

    if (!confirm(`Delete user "${targetUser.name}"?`)) return;

    try {
      await apiRequest(`/users/${selectedId}`, {
        method: 'DELETE',
        body: JSON.stringify({ version: targetUser.version }),
      });
      setSelectedId(null);
      fetchUsers();
    } catch (err: any) {
      if (err.currentVersion !== undefined) {
        setConflictError(err.error || 'Optimistic locking conflict on user deletion.');
      } else {
        alert(err.error || 'Failed to delete user');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const selectedUser = users.find((u) => u.id === selectedId);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-purple-500" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{t('userManagement')}</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Administrator console for viewing, blocking/unblocking, assigning roles, and managing platform users.
          </p>
        </div>
      </div>

      {conflictError && (
        <OptimisticLockingBanner message={conflictError} onReload={fetchUsers} onDismiss={() => setConflictError(null)} />
      )}

      {/* Table Toolbar with Role Switch & Block Actions */}
      <TableToolbar
        selectedCount={selectedId ? 1 : 0}
        totalCount={users.length}
        onDelete={handleDeleteUser}
        customActions={
          selectedUser && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleToggleBlock}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg text-white shadow ${
                  selectedUser.isBlocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {selectedUser.isBlocked ? 'Unblock Account' : 'Block Account'}
              </button>

              <select
                value={selectedUser.role}
                onChange={(e) => handleChangeRole(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="CANDIDATE">Role: CANDIDATE</option>
                <option value="RECRUITER">Role: RECRUITER</option>
                <option value="ADMIN">Role: ADMIN</option>
              </select>
            </div>
          )
        }
      />

      {/* Users Table View (Strict Table Compliance) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="p-4 w-12 text-center">Select</th>
              <th className="p-4">User Details</th>
              <th className="p-4 text-center">Role</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">System Activity</th>
              <th className="p-4 text-center">Version</th>
              <th className="p-4 text-right">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {users.map((u) => {
              const isSelected = selectedId === u.id;

              return (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(isSelected ? null : u.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-purple-500/10 dark:bg-purple-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedId(isSelected ? null : u.id)}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{u.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                          : u.role === 'RECRUITER'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        u.isBlocked
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {u.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-center text-xs text-slate-500 font-medium">
                    {u._count.cvs} CVs | {u._count.positions} Positions | {u._count.projects} Projects
                  </td>
                  <td className="p-4 text-center font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                    v{u.version}
                  </td>
                  <td className="p-4 text-right text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
