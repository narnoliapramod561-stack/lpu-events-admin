import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  Image as ImageIcon, 
  Power, 
  Trash2, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

export const CarouselPanel: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('carousel_items')
        .select('id, item_type, event_id, advertisement_id, media_id, sort_order, is_active, start_at, end_at, custom_title, custom_subtitle, display_duration_ms, created_at, events(name), advertisements(name)')
        .order('sort_order');
      if (err) throw err;
      setItems(data || []);
    } catch (err: any) {
      setError('Failed to load carousel items: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const toggleActive = async (id: string) => {
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageCarouselItem('toggle_active', { id });
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);
      setSuccess('Carousel item updated.');
      fetchItems();
    } catch (err: any) {
      setError('Update failed: ' + (err.message || ''));
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Remove this carousel slide?')) return;
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageCarouselItem('delete', { id });
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);
      setSuccess('Slide removed from carousel.');
      fetchItems();
    } catch (err: any) {
      setError('Delete failed: ' + (err.message || ''));
    }
  };

  const getItemLabel = (item: any): string => {
    if (item.item_type === 'EVENT') return item.events?.name || 'Featured Event';
    if (item.item_type === 'ADVERTISEMENT') return item.advertisements?.name || 'Sponsored Promotion';
    return item.custom_title || 'Media Slide';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">HOMEPAGE CURATION</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Hero Showcase</span>
          </div>
          <h2 className="page-title">Homepage Hero Carousel</h2>
          <p className="page-description">Curate and prioritize marquee hero banners, featured events, and top campus promotions.</p>
        </div>
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
        <div className="card-box-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="card-box-title">Configured Hero Slides</h3>
            <span className="badge badge-purple">{items.length} Slides</span>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Fetching carousel slides..." />
        ) : items.length === 0 ? (
          <EmptyState
            title="No Carousel Slides Configured"
            description="Hero carousel slides are populated automatically from featured events and active advertisements."
            icon={<ImageIcon size={26} />}
          />
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Order</th>
                  <th>Source Type</th>
                  <th>Slide Title / Content</th>
                  <th>Status</th>
                  <th>Schedule Window</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span className="badge badge-secondary" style={{ fontWeight: 800 }}>
                        #{item.sort_order}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {item.item_type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{getItemLabel(item)}</span>
                    </td>
                    <td>
                      {item.is_active ? (
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
                      <span style={{ color: 'var(--text-dim)', fontSize: '12.5px' }}>
                        {item.start_at ? `${new Date(item.start_at).toLocaleDateString()} – ${new Date(item.end_at).toLocaleDateString()}` : 'Always Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleActive(item.id)}
                        >
                          <Power size={13} />
                          <span>{item.is_active ? 'Disable' : 'Enable'}</span>
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => deleteItem(item.id)}
                          title="Remove Slide"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
