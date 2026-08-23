import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles,
  FileImage,
  FileCode
} from 'lucide-react';
import { 
  getStudentEventUrl, 
  generateQrDataUrl, 
  downloadQrCode 
} from '../../shared';

interface EventQrCardProps {
  eventId: string;
  eventName: string;
}

export const EventQrCard: React.FC<EventQrCardProps> = ({ eventId, eventName }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<'png' | 'svg' | null>(null);

  const eventUrl = getStudentEventUrl(eventId);

  useEffect(() => {
    let isMounted = true;
    if (!eventUrl) return;

    setLoading(true);
    generateQrDataUrl(eventUrl, { width: 400, margin: 2 })
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [eventUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy event URL:', err);
    }
  };

  const handleDownload = async (format: 'png' | 'svg') => {
    setDownloading(format);
    try {
      await downloadQrCode(eventUrl, eventName, format);
    } catch (err) {
      console.error(`Failed to download ${format.toUpperCase()} QR code:`, err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="card-box" style={{ overflow: 'hidden' }}>
      <div className="card-box-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <QrCode size={18} style={{ color: 'var(--accent-primary)' }} />
          <h3 className="card-box-title">Event QR Code</h3>
        </div>
        <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={12} />
          <span>Live Canonical Destination</span>
        </span>
      </div>

      <div className="card-box-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* QR Code Image Preview Container */}
          <div
            style={{
              width: '140px',
              height: '140px',
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md, 12px)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 107, 0, 0.25)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            {loading ? (
              <div style={{ fontSize: '11px', color: '#666', textAlign: 'center' }}>
                Generating...
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${eventName}`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }}
              />
            ) : (
              <div style={{ fontSize: '11px', color: '#999', textAlign: 'center' }}>
                QR Unavailable
              </div>
            )}
          </div>

          {/* QR Meta & Instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--accent-primary)'
                }}
              >
                Scan to Open Event
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Direct access for students — scans directly to the public Event Details page with <strong>no login required</strong>.
            </p>

            {/* URL Box with 1-click Copy & Open */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm, 8px)',
                padding: '6px 10px',
                gap: '8px',
                marginTop: '4px'
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: 'var(--text-main)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={eventUrl}
              >
                {eventUrl}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  title="Copy student link"
                >
                  {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <a
                  href={eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 8px', fontSize: '11px', textDecoration: 'none' }}
                  title="Open live student page in new tab"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Download Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleDownload('png')}
            disabled={downloading !== null || loading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <FileImage size={14} />
            <span>{downloading === 'png' ? 'Preparing PNG...' : 'Download PNG'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleDownload('svg')}
            disabled={downloading !== null || loading}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <FileCode size={14} />
            <span>{downloading === 'svg' ? 'Preparing SVG...' : 'Download Vector SVG'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
