'use client';

import { useState, useEffect } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  display_order: number;
  is_active: boolean;
  event_count: number;
  created_at: string;
  updated_at: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function CategoriesManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<Record<string, Subcategory[]>>({});
  const [loadingSubcategories, setLoadingSubcategories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/categories?limit=100');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch categories');
      }
    } catch {
      setError('Network error loading categories');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategories = async (categoryId: string) => {
    setLoadingSubcategories(prev => ({ ...prev, [categoryId]: true }));
    try {
      const response = await fetch(`/api/admin/subcategories?category_id=${categoryId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setSubcategories(prev => ({ ...prev, [categoryId]: data.data || [] }));
      }
    } catch {
      console.error('Failed to fetch subcategories');
    } finally {
      setLoadingSubcategories(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  useEffect(() => {
    (async () => {
      await fetchCategories();
    })();
  }, []);

  const handleCategoryClick = async (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
      if (!subcategories[categoryId]) {
        await fetchSubcategories(categoryId);
      }
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleToggleCategoryVisibility = async (id: string, currentStatus: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      if (response.ok) {
        await fetchCategories();
      }
    } catch {
      setError('Failed to update category visibility');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSubcategoryVisibility = async (categoryId: string, subcategoryId: string, currentStatus: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/subcategories/${subcategoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      if (response.ok) {
        await fetchSubcategories(categoryId);
      }
    } catch {
      setError('Failed to update subcategory visibility');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchCategories();
      }
    } catch {
      setError('Failed to delete category');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubcategory = async (categoryId: string, subcategoryId: string) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/subcategories/${subcategoryId}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchSubcategories(categoryId);
      }
    } catch {
      setError('Failed to delete subcategory');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveCategory = async (id: string, currentOrder: number, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: newOrder }),
      });
      if (response.ok) {
        await fetchCategories();
      }
    } catch {
      setError('Failed to reorder category');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-orange-400 mb-2">
            <span>Super Admin</span>
            <span className="text-white/20">•</span>
            <span className="text-white/60">Taxonomy Management</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Categories Management</h1>
          <p className="text-white/60">Configure, reorder, and manage event categories across the platform.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Add New Category
        </button>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">search</span>
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>
        <p className="text-sm text-white/60">{filteredCategories.length} Total Categories</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <div className="text-center py-12 text-white/40">No categories yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map((cat, idx) => (
            <div key={cat.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/[0.07] transition-colors">
              {/* Category Header */}
              <div className="flex justify-between items-start mb-4">
                <div 
                  className="flex-1 cursor-pointer" 
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl text-white/20 font-bold">#{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{cat.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cat.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {expandedCategory === cat.id ? (
                          <span className="material-symbols-outlined text-orange-400 text-sm">expand_less</span>
                        ) : (
                          <span className="material-symbols-outlined text-white/40 text-sm">expand_more</span>
                        )}
                      </div>
                      <code className="text-xs text-white/40 font-mono">/{cat.slug}</code>
                    </div>
                  </div>
                  {cat.description && (
                    <p className="text-sm text-white/60 mt-2">{cat.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveCategory(cat.id, cat.display_order, 'up')}
                    disabled={actionLoading || idx === 0}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition-colors"
                    title="Move Up"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                  </button>
                  <button
                    onClick={() => handleMoveCategory(cat.id, cat.display_order, 'down')}
                    disabled={actionLoading || idx === filteredCategories.length - 1}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition-colors"
                    title="Move Down"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_downward</span>
                  </button>
                </div>
              </div>

              {/* Category Actions */}
              <div className="flex justify-between items-center border-t border-white/5 pt-4 mb-4">
                <span className="text-xs text-white/40">{cat.event_count} event(s)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleCategoryVisibility(cat.id, cat.is_active)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {cat.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setEditingCategory(cat)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Subcategories Section */}
              {expandedCategory === cat.id && (
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white/80">Subcategories</h3>
                    <span className="text-xs text-white/40">
                      {subcategories[cat.id]?.length || 0} subcategories
                    </span>
                  </div>

                  {loadingSubcategories[cat.id] ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
                    </div>
                  ) : subcategories[cat.id]?.length === 0 ? (
                    <div className="text-center py-4 text-white/40 text-sm">No subcategories</div>
                  ) : (
                    <div className="space-y-2">
                      {subcategories[cat.id]?.map((sub) => (
                        <div key={sub.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-white">{sub.name}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${sub.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {sub.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <code className="text-xs text-white/30 font-mono">/{sub.slug}</code>
                              {sub.description && (
                                <p className="text-xs text-white/50 mt-1">{sub.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleToggleSubcategoryVisibility(cat.id, sub.id, sub.is_active)}
                                disabled={actionLoading}
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                                title={sub.is_active ? 'Deactivate' : 'Activate'}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {sub.is_active ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>
                              <button
                                onClick={() => setEditingSubcategory(sub)}
                                disabled={actionLoading}
                                className="p-1.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteSubcategory(cat.id, sub.id)}
                                disabled={actionLoading}
                                className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
