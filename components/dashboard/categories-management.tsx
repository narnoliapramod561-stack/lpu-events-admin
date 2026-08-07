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
  
  // Category Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Subcategory Modals State
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubSlug, setNewSubSlug] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
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

  // Category Actions
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName,
          slug: newCatSlug || newCatName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          description: newCatDesc,
        }),
      });
      if (response.ok) {
        setIsAddModalOpen(false);
        setNewCatName('');
        setNewCatSlug('');
        setNewCatDesc('');
        await fetchCategories();
      } else {
        const err = await response.json();
        setError(err.message || 'Failed to create category');
      }
    } catch {
      setError('Network error creating category');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCategory.name,
          slug: editingCategory.slug,
          description: editingCategory.description,
        }),
      });
      if (response.ok) {
        setEditingCategory(null);
        await fetchCategories();
      } else {
        const err = await response.json();
        setError(err.message || 'Failed to update category');
      }
    } catch {
      setError('Network error updating category');
    } finally {
      setActionLoading(false);
    }
  };

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

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? All subcategories will also be deleted.')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchCategories();
      } else {
        const err = await response.json();
        setError(err.message || 'Failed to delete category');
      }
    } catch {
      setError('Failed to delete category');
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

  // Subcategory Actions
  const handleAddSubcategory = async (categoryId: string) => {
    if (!newSubName.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: categoryId,
          name: newSubName,
          slug: newSubSlug || newSubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          description: newSubDesc,
        }),
      });
      if (response.ok) {
        setIsAddSubModalOpen(null);
        setNewSubName('');
        setNewSubSlug('');
        setNewSubDesc('');
        await fetchSubcategories(categoryId);
      } else {
        const err = await response.json();
        setError(err.message || 'Failed to create subcategory');
      }
    } catch {
      setError('Network error creating subcategory');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSubEdit = async () => {
    if (!editingSubcategory || !editingSubcategory.name.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/subcategories/${editingSubcategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingSubcategory.name,
          slug: editingSubcategory.slug,
          description: editingSubcategory.description,
        }),
      });
      if (response.ok) {
        const catId = editingSubcategory.category_id;
        setEditingSubcategory(null);
        await fetchSubcategories(catId);
      } else {
        const err = await response.json();
        setError(err.message || 'Failed to update subcategory');
      }
    } catch {
      setError('Network error updating subcategory');
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

  const handleDeleteSubcategory = async (categoryId: string, subcategoryId: string) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/subcategories/${subcategoryId}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchSubcategories(categoryId);
      } else {
        const err = await response.json();
        setError(err.message || 'Failed to delete subcategory');
      }
    } catch {
      setError('Failed to delete subcategory');
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
                    <button
                      onClick={() => setIsAddSubModalOpen(cat.id)}
                      className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      Add Subcategory
                    </button>
                  </div>

                  {loadingSubcategories[cat.id] ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
                    </div>
                  ) : subcategories[cat.id]?.length === 0 ? (
                    <div className="text-center py-4 text-white/40 text-sm">No subcategories yet</div>
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

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white">Add New Category</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Technical"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Slug</label>
                <input
                  type="text"
                  placeholder="e.g. technical"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Description</label>
                <textarea
                  placeholder="Brief description of this category"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setNewCatName('');
                  setNewCatSlug('');
                  setNewCatDesc('');
                }}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={actionLoading || !newCatName.trim()}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white">Edit Category</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Name *</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Slug *</label>
                <input
                  type="text"
                  value={editingCategory.slug}
                  onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Description</label>
                <textarea
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setEditingCategory(null)}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={actionLoading || !editingCategory.name.trim()}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subcategory Modal */}
      {isAddSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white">Add New Subcategory</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Hackathon"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setIsAddSubModalOpen(null);
                  setNewSubName('');
                  setNewSubSlug('');
                  setNewSubDesc('');
                }}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddSubcategory(isAddSubModalOpen)}
                disabled={actionLoading || !newSubName.trim()}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Subcategory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subcategory Modal */}
      {editingSubcategory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white">Edit Subcategory</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Name *</label>
                <input
                  type="text"
                  value={editingSubcategory.name}
                  onChange={(e) => setEditingSubcategory({ ...editingSubcategory, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Slug *</label>
                <input
                  type="text"
                  value={editingSubcategory.slug}
                  onChange={(e) => setEditingSubcategory({ ...editingSubcategory, slug: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">Description</label>
                <textarea
                  value={editingSubcategory.description || ''}
                  onChange={(e) => setEditingSubcategory({ ...editingSubcategory, description: e.target.value })}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setEditingSubcategory(null)}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubEdit}
                disabled={actionLoading || !editingSubcategory.name.trim()}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
