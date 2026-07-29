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

export function CategoriesManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

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
    } catch (err) {
      setError('Network error loading categories');
      // Error handled
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleToggleVisibility = async (id: string, currentStatus: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (response.ok) {
        await fetchCategories();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to update category');
      }
    } catch (err) {
      alert('Network error updating category');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveCategory = async (id: string, currentOrder: number, direction: 'up' | 'down') => {
    const targetOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: targetOrder }),
      });

      if (response.ok) {
        await fetchCategories();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to reorder category');
      }
    } catch (err) {
      alert('Network error reordering category');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string, eventCount: number) => {
    if (eventCount > 0) {
      alert(`Cannot delete category with ${eventCount} associated event(s). Please reassign or delete events first.`);
      return;
    }

    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCategories();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to delete category');
      }
    } catch (err) {
      alert('Network error deleting category');
    } finally {
      setActionLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      alert('Category name is required');
      return;
    }

    const slug = newCatSlug.trim() || generateSlug(newCatName);

    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
          slug,
          description: newCatDesc.trim() || null,
          display_order: categories.length,
          is_active: true,
        }),
      });

      if (response.ok) {
        setNewCatName('');
        setNewCatSlug('');
        setNewCatDesc('');
        setIsAddModalOpen(false);
        await fetchCategories();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to create category');
      }
    } catch (err) {
      alert('Network error creating category');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      alert('Category name is required');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCategory.name.trim(),
          slug: editingCategory.slug.trim(),
          description: editingCategory.description?.trim() || null,
        }),
      });

      if (response.ok) {
        setEditingCategory(null);
        await fetchCategories();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to update category');
      }
    } catch (err) {
      alert('Network error updating category');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/60">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto animate-fadeIn">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff914d]">
            <span>Super Admin</span>
            <span>•</span>
            <span>Taxonomy Management</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-1 font-display">
            Categories Management
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Configure, reorder, and manage event categories across the platform.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          disabled={actionLoading}
          className="bg-[#ff914d] hover:bg-[#e07530] text-[#050507] px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,145,77,0.3)] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">add</span> Add New Category
        </button>
      </header>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
          />
        </div>
        <p className="text-xs text-white/40 font-semibold">{categories.length} Total Categories</p>
      </div>

      {/* Categories Cards Deck */}
      {filteredCategories.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          {searchQuery ? 'No categories match your search' : 'No categories yet'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCategories.map((cat, idx) => (
            <div
              key={cat.id}
              className={`rounded-2xl border p-6 bg-white/5 backdrop-blur-md flex flex-col justify-between gap-6 transition-all ${cat.is_active ? 'border-white/10' : 'border-white/5 opacity-50'
                }`}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white/30 font-display">
                        #{cat.display_order}
                      </span>
                      <h3 className="text-xl font-bold text-white font-display">{cat.name}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-white/5 text-white/40 border-white/10'
                          }`}
                      >
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <code className="text-xs text-white/40 font-mono">/{cat.slug}</code>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveCategory(cat.id, cat.display_order, 'up')}
                      disabled={actionLoading || cat.display_order === 0}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition-colors"
                      title="Move Up"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    </button>
                    <button
                      onClick={() => handleMoveCategory(cat.id, cat.display_order, 'down')}
                      disabled={actionLoading}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition-colors"
                      title="Move Down"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_downward</span>
                    </button>
                  </div>
                </div>

                {cat.description && (
                  <p className="text-sm text-white/60 mt-2">{cat.description}</p>
                )}
              </div>

              <div className="flex justify-between items-center border-t border-white/5 pt-4">
                <span className="text-xs text-white/40">{cat.event_count} event(s)</span>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleVisibility(cat.id, cat.is_active)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all disabled:opacity-50"
                  >
                    {cat.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setEditingCategory(cat)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#ff914d] bg-[#ff914d]/10 border border-[#ff914d]/20 hover:bg-[#ff914d]/20 transition-all disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.event_count)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white font-display">Add New Category</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Category Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sports & Fitness"
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    if (!newCatSlug) {
                      setNewCatSlug(generateSlug(e.target.value));
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Slug * (URL-friendly identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g. sports-fitness"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Brief description of this category"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d] resize-none"
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
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-[#ff914d] hover:bg-[#e07530] disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white font-display">Edit Category</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, name: e.target.value })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Slug *
                </label>
                <input
                  type="text"
                  value={editingCategory.slug}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, slug: e.target.value })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Description
                </label>
                <textarea
                  value={editingCategory.description || ''}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d] resize-none"
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
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-[#ff914d] hover:bg-[#e07530] disabled:opacity-50"
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
