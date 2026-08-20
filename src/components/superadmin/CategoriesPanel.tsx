import React, { useState, useEffect, useMemo } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  FolderTree, 
  Plus, 
  Power, 
  CheckCircle2, 
  AlertCircle,
  CornerDownRight,
  X,
  Search
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

export const CategoriesPanel: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSubcategory, setShowAddSubcategory] = useState<string | null>(null);
  const [newCatKey, setNewCatKey] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newSubKey, setNewSubKey] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, subRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('subcategories').select('*').order('sort_order')
      ]);
      if (catRes.error) throw catRes.error;
      setCategories(catRes.data || []);
      setSubcategories(subRes.data || []);
    } catch (err: any) {
      setError('Failed to load categories: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatKey.trim() || !newCatName.trim()) {
      setError('Both key slug and display name are required.'); return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageCategory('create', {
        key: newCatKey.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newCatName.trim(),
        sort_order: categories.length + 1
      });
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);

      setSuccess('Primary category added successfully.');
      setShowAddCategory(false);
      setNewCatKey('');
      setNewCatName('');
      fetchData();
    } catch (err: any) {
      setError('Failed to add category: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent, categoryId: string) => {
    e.preventDefault();
    if (!newSubKey.trim() || !newSubName.trim()) {
      setError('Both key slug and display name are required.'); return;
    }
    setError('');
    setSubmitting(true);
    try {
      const subs = subcategories.filter(s => s.category_id === categoryId);
      const { data: result, error: rpcErr } = await lpuClient.manageSubcategory('create', {
        category_id: categoryId,
        key: newSubKey.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newSubName.trim(),
        sort_order: subs.length + 1
      });
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);

      setSuccess('Subcategory added successfully.');
      setShowAddSubcategory(null);
      setNewSubKey('');
      setNewSubName('');
      fetchData();
    } catch (err: any) {
      setError('Failed to add subcategory: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (table: 'categories' | 'subcategories', id: string) => {
    try {
      let rpcErr;
      let result;
      if (table === 'categories') {
        const res = await lpuClient.manageCategory('toggle_active', { id });
        result = res.data;
        rpcErr = res.error;
      } else {
        const res = await lpuClient.manageSubcategory('toggle_active', { id });
        result = res.data;
        rpcErr = res.error;
      }
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);
      fetchData();
    } catch (err: any) {
      setError('Failed to toggle active status: ' + (err.message || ''));
    }
  };

  const cleanSearch = searchTerm.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!cleanSearch) return categories;
    return categories.filter(cat => {
      const catMatches = cat.name.toLowerCase().includes(cleanSearch) || (cat.key || '').toLowerCase().includes(cleanSearch);
      const subMatches = subcategories.some(s => s.category_id === cat.id && (s.name.toLowerCase().includes(cleanSearch) || (s.key || '').toLowerCase().includes(cleanSearch)));
      return catMatches || subMatches;
    });
  }, [categories, subcategories, cleanSearch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">CONTENT TAXONOMY</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Classification Engine</span>
          </div>
          <h2 className="page-title">Taxonomy & Category Manager</h2>
          <p className="page-description">Manage hierarchical categories, subcategories, and search tag filters across all university events.</p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAddCategory(true)}>
          <Plus size={16} />
          <span>New Category</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-subtle)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card-box">
        <div className="card-box-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="card-box-title">Taxonomy Hierarchy</h3>
            <span className="badge badge-purple">{filteredCategories.length} Categories</span>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search category or subcategory..."
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '12.5px', height: '34px' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="btn btn-ghost btn-icon"
                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', padding: '2px' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Fetching categories and subcategories..." />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No Categories Configured"
            description="Create your first event category to structure the student portal."
            icon={<FolderTree size={26} />}
            actionLabel="+ Add Category"
            onAction={() => setShowAddCategory(true)}
          />
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Key Slug</th>
                  <th>Category / Subcategory Name</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Subcategories</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map(cat => {
                  const subs = subcategories.filter(s => {
                    if (s.category_id !== cat.id) return false;
                    if (!cleanSearch) return true;
                    const catMatches = cat.name.toLowerCase().includes(cleanSearch) || (cat.key || '').toLowerCase().includes(cleanSearch);
                    if (catMatches) return true;
                    return s.name.toLowerCase().includes(cleanSearch) || (s.key || '').toLowerCase().includes(cleanSearch);
                  });

                  return (
                    <React.Fragment key={cat.id}>
                      {/* Parent Category Row */}
                      <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.015)' }}>
                        <td>
                          <span className="font-mono" style={{ fontSize: '12.5px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {cat.key}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)' }}>{cat.name}</span>
                        </td>
                        <td>
                          <span className="badge badge-secondary">#{cat.sort_order}</span>
                        </td>
                        <td>
                          {cat.is_active ? (
                            <span className="badge badge-success">
                              <span className="badge-dot" />
                              <span>ACTIVE</span>
                            </span>
                          ) : (
                            <span className="badge badge-danger">
                              <span className="badge-dot" />
                              <span>DISABLED</span>
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                            {subs.length} subcategories
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => toggleActive('categories', cat.id)}
                            >
                              <Power size={13} />
                              <span>{cat.is_active ? 'Disable' : 'Enable'}</span>
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { setShowAddSubcategory(cat.id); setNewSubKey(''); setNewSubName(''); }}
                            >
                              <Plus size={13} />
                              <span>Subcategory</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Nested Subcategories */}
                      {subs.map(sub => (
                        <tr key={sub.id} style={{ backgroundColor: 'transparent' }}>
                          <td style={{ paddingLeft: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CornerDownRight size={13} color="var(--text-dim)" />
                              <span className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                                {sub.key}
                              </span>
                            </div>
                          </td>
                          <td style={{ paddingLeft: '24px' }}>
                            <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>{sub.name}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>#{sub.sort_order}</span>
                          </td>
                          <td>
                            {sub.is_active ? (
                              <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 6px' }}>
                                ACTIVE
                              </span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: '9px', padding: '1px 6px' }}>
                                DISABLED
                              </span>
                            )}
                          </td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleActive('subcategories', sub.id)}
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                            >
                              {sub.is_active ? 'Disable' : 'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">New Primary Category</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddCategory(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCategory}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="catName" className="form-label">Category Name *</label>
                  <input
                    id="catName"
                    type="text"
                    value={newCatName}
                    onChange={e => {
                      setNewCatName(e.target.value);
                      if (!newCatKey || newCatKey === newCatName.toLowerCase().replace(/\s+/g, '_')) {
                        setNewCatKey(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                      }
                    }}
                    placeholder="e.g. Robotics & AI"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="catKey" className="form-label">Key Identifier Slug *</label>
                  <input
                    id="catKey"
                    type="text"
                    value={newCatKey}
                    onChange={e => setNewCatKey(e.target.value)}
                    placeholder="e.g. robotics_ai"
                    className="form-input font-mono"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddCategory(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subcategory Modal */}
      {showAddSubcategory && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Add Subcategory</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddSubcategory(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={e => handleAddSubcategory(e, showAddSubcategory)}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="subName" className="form-label">Subcategory Name *</label>
                  <input
                    id="subName"
                    type="text"
                    value={newSubName}
                    onChange={e => {
                      setNewSubName(e.target.value);
                      if (!newSubKey || newSubKey === newSubName.toLowerCase().replace(/\s+/g, '_')) {
                        setNewSubKey(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                      }
                    }}
                    placeholder="e.g. Battlebots"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subKey" className="form-label">Subcategory Key Slug *</label>
                  <input
                    id="subKey"
                    type="text"
                    value={newSubKey}
                    onChange={e => setNewSubKey(e.target.value)}
                    placeholder="e.g. battlebots"
                    className="form-input font-mono"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSubcategory(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Subcategory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
