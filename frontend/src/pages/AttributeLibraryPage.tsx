import React, { useState, useEffect } from 'react';
import { apiRequest, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useThemeLanguage } from '../context/ThemeLanguageContext';
import { TableToolbar } from '../components/TableToolbar';
import { OptimisticLockingBanner } from '../components/OptimisticLockingBanner';
import { Layers, Plus, Search, Filter, Hash, Type, Image as ImageIcon, Calendar, CheckSquare, ListFilter, AlertCircle, X, Check } from 'lucide-react';

interface Attribute {
  id: string;
  name: string;
  description: string;
  dataType: string;
  optionsJson?: string;
  version: number;
  categoryId: string;
  category: { id: string; name: string };
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
}

export const AttributeLibraryPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useThemeLanguage();

  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Table selection (strictly obeying Toolbar pattern)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modal form states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    dataType: 'STRING',
    categoryId: '',
    options: [] as string[],
    version: 1,
  });
  const [optionInput, setOptionInput] = useState('');

  // Optimistic locking conflict state
  const [conflictError, setConflictError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attrs, cats] = await Promise.all([
        apiRequest<Attribute[]>(`/attributes?search=${encodeURIComponent(search)}&categoryId=${selectedCategory}`),
        apiRequest<Category[]>('/attributes/categories'),
      ]);
      setAttributes(attrs);
      setCategories(cats);
      setConflictError(null);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, selectedCategory]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormData({
      id: '',
      name: '',
      description: '',
      dataType: 'STRING',
      categoryId: categories[0]?.id || '',
      options: ['Option 1', 'Option 2'],
      version: 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = () => {
    if (!selectedId) return;
    const attr = attributes.find((a) => a.id === selectedId);
    if (!attr) return;

    let parsedOptions: string[] = [];
    if (attr.optionsJson) {
      try {
        parsedOptions = JSON.parse(attr.optionsJson);
      } catch (e) {}
    }

    setIsEditing(true);
    setFormData({
      id: attr.id,
      name: attr.name,
      description: attr.description || '',
      dataType: attr.dataType,
      categoryId: attr.categoryId,
      options: parsedOptions,
      version: attr.version,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        // Update with version for Optimistic Locking
        await apiRequest(`/attributes/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        // Create
        await apiRequest('/attributes', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      setSelectedId(null);
      fetchData();
    } catch (err: any) {
      if (err.currentVersion !== undefined || err.error?.includes('Optimistic')) {
        setConflictError(err.error || 'Optimistic locking conflict on attribute update.');
      } else {
        alert(err.error || 'Failed to save attribute');
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const attr = attributes.find((a) => a.id === selectedId);
    if (!attr) return;

    if (!confirm(`Are you sure you want to delete attribute "${attr.name}"?`)) return;

    try {
      await apiRequest(`/attributes/${selectedId}`, {
        method: 'DELETE',
        body: JSON.stringify({ version: attr.version }),
      });
      setSelectedId(null);
      fetchData();
    } catch (err: any) {
      if (err.currentVersion !== undefined || err.error?.includes('Optimistic')) {
        setConflictError(err.error || 'Optimistic locking conflict on attribute delete.');
      } else {
        alert(err.error || 'Failed to delete attribute');
      }
    }
  };

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'NUMERIC':
        return <Hash className="w-4 h-4 text-emerald-500" />;
      case 'TEXT':
        return <Type className="w-4 h-4 text-blue-500" />;
      case 'IMAGE':
        return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case 'DATE':
      case 'PERIOD':
        return <Calendar className="w-4 h-4 text-amber-500" />;
      case 'BOOLEAN':
        return <CheckSquare className="w-4 h-4 text-indigo-500" />;
      case 'ONE_OF_MANY':
        return <ListFilter className="w-4 h-4 text-rose-500" />;
      default:
        return <Type className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{t('attributeLibrary')}</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global repository of structured attributes reusable across candidate profiles and position templates.
          </p>
        </div>
      </div>

      {/* Optimistic Locking Conflict Notification */}
      {conflictError && (
        <OptimisticLockingBanner message={conflictError} onReload={fetchData} onDismiss={() => setConflictError(null)} />
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search attributes by prefix..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="relative min-w-[180px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Toolbar (STRICT PDF WARNING COMPLIANCE) */}
      <TableToolbar
        selectedCount={selectedId ? 1 : 0}
        totalCount={attributes.length}
        onEdit={user?.role === 'RECRUITER' || user?.role === 'ADMIN' ? handleOpenEdit : undefined}
        onDelete={user?.role === 'RECRUITER' || user?.role === 'ADMIN' ? handleDelete : undefined}
        onCreateNew={user?.role === 'RECRUITER' || user?.role === 'ADMIN' ? handleOpenCreate : undefined}
        createButtonLabel="Add New Attribute"
      />

      {/* Attributes Table View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="p-4 w-12 text-center">Select</th>
              <th className="p-4">Attribute Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Data Type</th>
              <th className="p-4">Description / Options</th>
              <th className="p-4 text-center">Version (Locking)</th>
              <th className="p-4 text-right">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {attributes.map((attr) => {
              const isSelected = selectedId === attr.id;
              let optionsList: string[] = [];
              if (attr.optionsJson) {
                try {
                  optionsList = JSON.parse(attr.optionsJson);
                } catch (e) {}
              }

              return (
                <tr
                  key={attr.id}
                  onClick={() => setSelectedId(isSelected ? null : attr.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-500/10 dark:bg-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedId(isSelected ? null : attr.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{attr.name}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {attr.category.name}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold">
                      {getDataTypeIcon(attr.dataType)}
                      <span>{attr.dataType}</span>
                    </div>
                  </td>
                  <td className="p-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    <div>{attr.description || 'No description'}</div>
                    {optionsList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {optionsList.map((opt) => (
                          <span
                            key={opt}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      v{attr.version}
                    </span>
                  </td>
                  <td className="p-4 text-right text-xs text-slate-400">
                    {new Date(attr.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Form for Create / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                {isEditing ? `Edit Attribute (v${formData.version})` : 'Create New Attribute'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Globally Unique Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. IELTS Score, CAP Level"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Data Type</label>
                  <select
                    value={formData.dataType}
                    onChange={(e) => setFormData({ ...formData, dataType: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="STRING">String (Plain text)</option>
                    <option value="TEXT">Text (Markdown)</option>
                    <option value="NUMERIC">Numeric</option>
                    <option value="DATE">Date</option>
                    <option value="PERIOD">Period (Date Range)</option>
                    <option value="BOOLEAN">Boolean (Checkbox)</option>
                    <option value="IMAGE">Image (External Cloud)</option>
                    <option value="ONE_OF_MANY">One of Many (Dropdown)</option>
                  </select>
                </div>
              </div>

              {formData.dataType === 'ONE_OF_MANY' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Dropdown Options</label>
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="text"
                      placeholder="Add option..."
                      value={optionInput}
                      onChange={(e) => setOptionInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (optionInput.trim()) {
                          setFormData({ ...formData, options: [...formData.options, optionInput.trim()] });
                          setOptionInput('');
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.options.map((opt, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded flex items-center space-x-1">
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, options: formData.options.filter((_, idx) => idx !== i) })}
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Attribute purpose or instructions..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700"
                >
                  {isEditing ? 'Save Changes' : 'Create Attribute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
