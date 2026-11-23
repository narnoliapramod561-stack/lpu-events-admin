import React, { useState, useRef } from 'react';
import { supabase } from '../../../supabase';
import { uploadAndOptimizeImage } from '../../../shared/images/uploader';
import type { AdPlacementSlot } from '../../../shared/ads/adTypes';

interface AdPositionSlotBoxProps {
  slot: AdPlacementSlot;
  boxTitle: string;
  badge?: string;
  aspectRatioText: string;
  aspectRatioClass?: string;
  minRatio?: number;
  maxRatio?: number;
  showPositionSelector?: boolean;
  showDurationSlider?: boolean;
  positionLabel?: string;
  onSave: (updatedSlot: AdPlacementSlot) => Promise<void>;
  onDelete?: () => Promise<void>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const AdPositionSlotBox: React.FC<AdPositionSlotBoxProps> = ({
  slot,
  boxTitle,
  badge,
  aspectRatioText,
  aspectRatioClass = 'aspect-video',
  minRatio,
  maxRatio,
  showPositionSelector = false,
  showDurationSlider = false,
  positionLabel = 'Insert after card index',
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const [data, setData] = useState<AdPlacementSlot>(slot);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync if prop updates externally
  React.useEffect(() => {
    setData(slot);
  }, [slot]);

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('Image size must be under 15MB.');
      return;
    }

    setErrorMessage(null);
    setAspectWarning(null);

    // Fast local preview
    const previewUrl = URL.createObjectURL(file);
    setData((prev) => ({ ...prev, image_url: previewUrl }));

    // Aspect ratio check
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      if (minRatio && maxRatio && (ratio < minRatio || ratio > maxRatio)) {
        setAspectWarning(
          `Image ratio (${ratio.toFixed(2)}:1) deviates from recommended ${aspectRatioText}. It may be letterboxed or cropped.`
        );
      }
    };
    img.src = previewUrl;

    // Launch upload directly to Cloudflare R2
    setIsUploading(true);
    setUploadStep('Uploading to Cloudflare R2...');

    try {
      const result = await uploadAndOptimizeImage({
        supabase,
        file,
        context: 'advertisement',
        onProgress: (step) => {
          if (step === 'validating') setUploadStep('Validating creative...');
          else if (step === 'compressing') setUploadStep('Optimizing WebP variants...');
          else if (step === 'uploading') setUploadStep('Storing in Cloudflare R2...');
        },
      });

      if (result?.publicUrl) {
        setData((prev) => ({
          ...prev,
          image_url: result.publicUrl,
          mobile_image_url: result.publicUrl,
          media_id: result.mediaId || null,
        }));
        setUploadStep(null);
      }
    } catch (err: any) {
      console.error('Ad position upload error:', err);
      setErrorMessage(err?.message || 'Failed to upload creative image to Cloudflare R2.');
      setUploadStep(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      // Validate
      if (data.is_active && !data.image_url) {
        throw new Error('Please upload an image before activating this ad box.');
      }

      if (data.redirect_url && !data.redirect_url.match(/^https?:\/\//i)) {
        throw new Error('Redirect URL must start with http:// or https://');
      }

      await onSave(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save position settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden mb-6">
      {/* Box Header */}
      <div className="px-6 py-4 bg-slate-50/80 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              {badge}
            </span>
          )}
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {boxTitle}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Reordering Buttons */}
          {(onMoveUp || onMoveDown) && (
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-0.5">
              {onMoveUp && (
                <button
                  type="button"
                  onClick={onMoveUp}
                  title="Move Up"
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">arrow_upward</span>
                </button>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  onClick={onMoveDown}
                  title="Move Down"
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">arrow_downward</span>
                </button>
              )}
            </div>
          )}

          {/* Active Switch */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
              {data.is_active ? 'Active' : 'Disabled'}
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={data.is_active}
                onChange={(e) => setData({ ...data, is_active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-primary-600"></div>
            </div>
          </label>

          {/* Delete Slot Button */}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Remove this slot"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Box Body */}
      <div className="p-6">
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {aspectWarning && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>{aspectWarning}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Direct R2 Upload & Preview Area */}
          <div className="lg:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-2">
              Ad Creative Picture (Cloudflare R2)
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`relative ${aspectRatioClass} w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 cursor-pointer overflow-hidden ${
                isDragOver
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                  : data.image_url
                  ? 'border-slate-200 dark:border-zinc-700 bg-slate-900'
                  : 'border-slate-300 dark:border-zinc-700 hover:border-primary-400 bg-slate-50 dark:bg-zinc-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              {data.image_url ? (
                <>
                  <img
                    src={data.image_url}
                    alt={data.title || 'Ad Preview'}
                    className="w-full h-full object-cover object-center rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-4 text-center">
                    <span className="material-symbols-outlined text-3xl mb-1">change_circle</span>
                    <span className="text-xs font-semibold">Click or Drop to Replace Picture</span>
                    <span className="text-[10px] text-zinc-300 mt-1">{aspectRatioText}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center p-3 select-none">
                  <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Upload Ad Picture
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Drag & drop or click to browse
                  </span>
                  <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold mt-2 px-2 py-0.5 bg-primary-50 dark:bg-primary-950/40 rounded">
                    {aspectRatioText}
                  </span>
                </div>
              )}

              {/* Uploading Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                  <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs font-semibold">{uploadStep || 'Storing in R2...'}</span>
                </div>
              )}
            </div>

            {data.image_url && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="material-symbols-outlined text-sm">verified</span> Stored in R2 CDN
                </span>
                <button
                  type="button"
                  onClick={() => setData({ ...data, image_url: '', mobile_image_url: null, media_id: null })}
                  className="text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:underline"
                >
                  Clear Image
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Inline Metadata & Position Settings */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Campaign / Ad Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Campaign / Ad Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Red Bull Campus Launch"
                  value={data.title}
                  onChange={(e) => setData({ ...data, title: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Sponsor Brand */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Sponsor Brand Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Red Bull India"
                  value={data.sponsor_name || ''}
                  onChange={(e) => setData({ ...data, sponsor_name: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Target Redirect URL */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Destination URL <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 material-symbols-outlined text-slate-400 text-sm">link</span>
                  <input
                    type="url"
                    placeholder="https://example.com/fest-offer"
                    value={data.redirect_url}
                    onChange={(e) => setData({ ...data, redirect_url: e.target.value })}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* CTA Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  CTA Button Label
                </label>
                <input
                  type="text"
                  placeholder="Know More"
                  value={data.cta_text}
                  onChange={(e) => setData({ ...data, cta_text: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Badge Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Badge Label
                </label>
                <input
                  type="text"
                  placeholder="SPONSORED"
                  value={data.badge_text}
                  onChange={(e) => setData({ ...data, badge_text: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Position Selector (if applicable) */}
              {showPositionSelector && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    {positionLabel}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={data.after_index ?? 2}
                    onChange={(e) => setData({ ...data, after_index: parseInt(e.target.value, 10) || 1 })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              {/* Duration Slider (if applicable) */}
              {showDurationSlider && (
                <div className={showPositionSelector ? '' : 'sm:col-span-2'}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Display Duration: {(data.display_duration_ms / 1000).toFixed(1)}s
                    </label>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="15000"
                    step="500"
                    value={data.display_duration_ms}
                    onChange={(e) => setData({ ...data, display_duration_ms: parseInt(e.target.value, 10) })}
                    className="w-full accent-primary-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg"
                  />
                  <div className="flex gap-1.5 mt-1">
                    {[3000, 5000, 7000, 10000].map((ms) => (
                      <button
                        key={ms}
                        type="button"
                        onClick={() => setData({ ...data, display_duration_ms: ms })}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          data.display_duration_ms === ms
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                        }`}
                      >
                        {ms / 1000}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions for This Box */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                Slot Key: <code className="bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">{data.slot_key}</code>
              </span>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isUploading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Position...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>Save This Position</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
