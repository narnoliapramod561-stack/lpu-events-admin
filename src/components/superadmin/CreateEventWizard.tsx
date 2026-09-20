import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth';
import { supabase, lpuClient } from '../../supabase';
import { PublishEventPayload, ContentSectionInput, uploadAndOptimizeImage, toLocalDateString, getOptimizedImage } from '@lpu-events/shared';
import { CustomDatePicker, CustomTimePicker } from '../common/CustomDateTimePicker';
import { AutoExpandingTextarea } from '../common/AutoExpandingTextarea';

interface CreateEventWizardProps {
  editEventId?: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

export const CreateEventWizard: React.FC<CreateEventWizardProps> = ({
  editEventId,
  onComplete,
  onCancel
}) => {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state - 4 distinct schedule options: Start Date, End Date, Start Time, End Time
  const [orgId, setOrgId] = useState<string>('');
  const [orgMode, setOrgMode] = useState<'SELECT' | 'MANUAL'>('SELECT');
  const [manualOrgName, setManualOrgName] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venueName, setVenueName] = useState('');
  const [showBlockSelect, setShowBlockSelect] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [registrationMode, setRegistrationMode] = useState<'EXTERNAL' | 'NONE'>('EXTERNAL');
  const [externalUrl, setExternalUrl] = useState('');
  const [pricingType, setPricingType] = useState<'FREE' | 'PAID'>('FREE');
  const [priceAmount, setPriceAmount] = useState<number | ''>('');
  const [registrationFormat, setRegistrationFormat] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL');
  const [capacityLimit, setCapacityLimit] = useState<number | ''>('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerFileName, setBannerFileName] = useState('');
  const [bannerMediaId, setBannerMediaId] = useState<string | null>(null);
  const [slotPreviews, setSlotPreviews] = useState<Record<string, string> | null>(null);
  const [activeSlotPreview, setActiveSlotPreview] = useState<'card' | 'banner' | 'thumb'>('card');
  const [optimizingImage, setOptimizingImage] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState<string>('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [imageStats, setImageStats] = useState<{
    originalSize: number;
    optimizedSize: number;
    savings: number;
    width: number;
    height: number;
  } | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Content sections
  const [sections, setSections] = useState<ContentSectionInput[]>([
    {
      section_type: 'ABOUT',
      title: 'About the Event',
      content: '',
      sort_order: 0
    }
  ]);
  const [expandedSections, setExpandedSections] = useState<number[]>([0]);

  const steps = [
    { num: 1, label: 'Basic Info', icon: 'info' },
    { num: 2, label: 'Schedule', icon: 'calendar_today' },
    { num: 3, label: 'Venue', icon: 'location_on' },
    { num: 4, label: 'Content', icon: 'article' },
    { num: 5, label: 'Pricing & Tickets', icon: 'payments' },
    { num: 6, label: 'Review & Publish', icon: 'task_alt' }
  ];

  const DRAFT_KEY = 'lpu_event_creator_draft_v2';
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore draft on mount if not in edit mode
  useEffect(() => {
    if (editEventId) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.name || draft.description || draft.startDate || draft.venueName || draft.orgId || draft.manualOrgName) {
          if (draft.orgId) setOrgId(draft.orgId);
          if (draft.orgMode) setOrgMode(draft.orgMode);
          if (draft.manualOrgName) setManualOrgName(draft.manualOrgName);
          if (draft.name) setName(draft.name);
          if (draft.description) setDescription(draft.description);
          if (draft.categoryId) setCategoryId(draft.categoryId);
          if (draft.subcategoryId) setSubcategoryId(draft.subcategoryId);
          if (draft.startDate) setStartDate(draft.startDate);
          if (draft.endDate) setEndDate(draft.endDate);
          if (draft.startTime) setStartTime(draft.startTime);
          if (draft.endTime) setEndTime(draft.endTime);
          if (draft.venueName) setVenueName(draft.venueName);
          if (draft.registrationMode) setRegistrationMode(draft.registrationMode);
          if (draft.externalUrl) setExternalUrl(draft.externalUrl);
          if (draft.pricingType) setPricingType(draft.pricingType);
          if (draft.priceAmount !== undefined) setPriceAmount(draft.priceAmount);
          if (draft.registrationFormat) setRegistrationFormat(draft.registrationFormat);
          if (draft.capacityLimit !== undefined) setCapacityLimit(draft.capacityLimit);
          if (draft.sections && draft.sections.length > 0) setSections(draft.sections);
          if (draft.expandedSections && draft.expandedSections.length > 0) setExpandedSections(draft.expandedSections);
          if (draft.bannerUrl) setBannerUrl(draft.bannerUrl);
          if (draft.bannerFileName) setBannerFileName(draft.bannerFileName);
          if (draft.bannerMediaId) setBannerMediaId(draft.bannerMediaId);
          if (draft.imageStats) setImageStats(draft.imageStats);
          if (draft.currentStep) setCurrentStep(draft.currentStep);
          setDraftRestored(true);
        }
      }
    } catch (e) {
      console.warn('Failed to restore draft:', e);
    }
  }, [editEventId]);

  // Auto-save draft on every change
  useEffect(() => {
    if (editEventId) return;
    // Only save if there's actual content
    if (!name && !description && !startDate && !venueName && !orgId && !manualOrgName && sections.length <= 1) return;

    const draftData = {
      orgId,
      orgMode,
      manualOrgName,
      name,
      description,
      categoryId,
      subcategoryId,
      startDate,
      endDate,
      startTime,
      endTime,
      venueName,
      registrationMode,
      externalUrl,
      pricingType,
      priceAmount,
      registrationFormat,
      capacityLimit,
      sections,
      expandedSections,
      bannerUrl,
      bannerFileName,
      bannerMediaId,
      imageStats,
      currentStep,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    } catch (e) {
      console.warn('Failed to save draft:', e);
    }
  }, [
    editEventId,
    orgId,
    orgMode,
    manualOrgName,
    name,
    description,
    categoryId,
    subcategoryId,
    startDate,
    endDate,
    startTime,
    endTime,
    venueName,
    registrationMode,
    externalUrl,
    pricingType,
    priceAmount,
    registrationFormat,
    capacityLimit,
    sections,
    expandedSections,
    bannerUrl,
    bannerFileName,
    bannerMediaId,
    imageStats,
    currentStep
  ]);

  // Prevent accidental touchpad back-swipe navigation gesture and warn beforeunload if draft active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (name.trim() || description.trim() || startDate) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [name, description, startDate]);

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setName('');
    setOrgId('');
    setOrgMode('SELECT');
    setManualOrgName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setVenueName('');
    setRegistrationMode('EXTERNAL');
    setExternalUrl('');
    setPricingType('FREE');
    setPriceAmount('');
    setRegistrationFormat('INDIVIDUAL');
    setCapacityLimit('');
    setSections([
      {
        section_type: 'ABOUT',
        title: 'About the Event',
        content: '',
        sort_order: 0
      }
    ]);
    setBannerMediaId(null);
    setImageStats(null);
    setCurrentStep(1);
    setDraftRestored(false);
  };

  // Load organizations & categories once on initial mount without unmounting during blur/focus
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (categories.length === 0) setLoading(true);
      try {
        // Query Supabase directly for categories and subcategories
        const [catsRes, subsRes, orgsRes] = await Promise.all([
          supabase.from('categories').select('id, key, name, is_active, sort_order').eq('is_active', true).order('sort_order'),
          supabase.from('subcategories').select('id, category_id, key, name, is_active, sort_order').eq('is_active', true).order('sort_order'),
          supabase.from('organizations').select('id, name').eq('is_active', true).order('name')
        ]);

        if (!mounted) return;

        let cats: any[] = [];
        if (catsRes.data && catsRes.data.length > 0) {
          const subMap: Record<string, any[]> = {};
          (subsRes.data || []).forEach((s: any) => {
            if (!subMap[s.category_id]) subMap[s.category_id] = [];
            subMap[s.category_id].push(s);
          });
          cats = catsRes.data.map((c: any) => ({
            ...c,
            subcategories: subMap[c.id] || []
          }));
        } else {
          // Edge fallback if direct Supabase query returned no categories
          const edgeRes = await lpuClient.fetchCategories();
          if (edgeRes.data && edgeRes.data.length > 0) {
            cats = edgeRes.data;
          }
        }

        if (cats.length > 0) {
          setCategories(cats);
          setCategoryId((prev) => {
            if (editEventId && prev) {
              return prev;
            }
            const initialCatId = prev || (editEventId ? '' : cats[0].id);
            const currentCat = cats.find((c: any) => c.id === initialCatId) || cats[0];
            const rawSubs = currentCat?.subcategories || [];
            const sorted = [...rawSubs].sort((a: any, b: any) => {
              const aIsOther = a.name.toLowerCase().includes('other') || a.name.toLowerCase().includes('miscellaneous');
              const bIsOther = b.name.toLowerCase().includes('other') || b.name.toLowerCase().includes('miscellaneous');
              if (aIsOther && !bIsOther) return 1;
              if (!aIsOther && bIsOther) return -1;
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
            if (sorted.length > 0 && !editEventId) {
              setSubcategoryId((prevSub) => prevSub || sorted[0].id);
            }
            return initialCatId;
          });
        }

        if (orgsRes.data && orgsRes.data.length > 0) {
          const orgs = orgsRes.data;
          setOrganizations(orgs);
          if (profile?.org_id) {
            setOrgId(profile.org_id);
          } else {
            setOrgId((prev) => prev || orgs[0].id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [profile?.id, profile?.org_id]);

  // Available subcategories for selected category with "Others" guaranteed at the end
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const rawSubcategories = selectedCategory?.subcategories || [];
  const subcategories = React.useMemo(() => {
    return [...rawSubcategories].sort((a: any, b: any) => {
      const aIsOther = a.name.toLowerCase().includes('other') || a.name.toLowerCase().includes('miscellaneous');
      const bIsOther = b.name.toLowerCase().includes('other') || b.name.toLowerCase().includes('miscellaneous');
      if (aIsOther && !bIsOther) return 1;
      if (!aIsOther && bIsOther) return -1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [rawSubcategories]);

  // Reactive safeguard: Ensure subcategoryId is selected whenever subcategories become available
  useEffect(() => {
    if (!editEventId && subcategories.length > 0) {
      if (!subcategoryId || !subcategories.some((s: any) => s.id === subcategoryId)) {
        setSubcategoryId(subcategories[0].id);
      }
    }
  }, [editEventId, subcategories, subcategoryId]);

  // Keep subcategoryId aligned when category changes
  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = categories.find((c) => c.id === newCatId);
    const rawSubs = cat?.subcategories || [];
    const sorted = [...rawSubs].sort((a: any, b: any) => {
      const aIsOther = a.name.toLowerCase().includes('other') || a.name.toLowerCase().includes('miscellaneous');
      const bIsOther = b.name.toLowerCase().includes('other') || b.name.toLowerCase().includes('miscellaneous');
      if (aIsOther && !bIsOther) return 1;
      if (!aIsOther && bIsOther) return -1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    if (sorted.length > 0) {
      setSubcategoryId(sorted[0].id);
    } else {
      setSubcategoryId('');
    }
  };

  // Handle direct file image upload for banner with automated optimization & Cloudflare R2 upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setOptimizingImage(true);
    setUploadProgressStep('Validating image headers...');
    setUploadProgressPercent(20);
    setBannerFileName(file.name);

    try {
      const result = await uploadAndOptimizeImage({
        supabase,
        file,
        context: 'event-banner',
        adminUserId: profile?.id,
        entityId: editEventId || undefined,
        onProgress: (step) => {
          if (step === 'validating') {
            setUploadProgressStep('Validating format & magic bytes...');
            setUploadProgressPercent(25);
          } else if (step === 'enhancing') {
            setUploadProgressStep('Enhancing fidelity & typography...');
            setUploadProgressPercent(50);
          } else if (step === 'compressing') {
            setUploadProgressStep('Generating WebP responsive variants...');
            setUploadProgressPercent(75);
          } else if (step === 'uploading') {
            setUploadProgressStep('Storing into Cloudflare R2...');
            setUploadProgressPercent(90);
          } else if (step === 'completed') {
            setUploadProgressStep('Upload complete!');
            setUploadProgressPercent(100);
          }
        }
      });

      setBannerUrl(result.dataUrl || result.publicUrl);
      setBannerMediaId(result.mediaId);
      if (result.slots) {
        setSlotPreviews({
          card: result.slots.card?.dataUrl || result.slots.card?.publicUrl || '',
          banner: result.slots.banner?.dataUrl || result.slots.banner?.publicUrl || '',
          thumb: result.slots.thumb?.dataUrl || result.slots.thumb?.publicUrl || ''
        });
      } else {
        setSlotPreviews(null);
      }
      setImageStats({
        originalSize: result.originalSizeBytes,
        optimizedSize: result.fileSizeBytes,
        savings: result.savingsPercentage,
        width: result.width,
        height: result.height
      });
      setError('');
    } catch (err: any) {
      console.error('Image optimization upload error:', err);
      setError('Image upload failed: ' + (err.message || 'Validation or network failed.'));
      setBannerUrl('');
      setBannerMediaId(null);
      setBannerFileName('');
      setSlotPreviews(null);
    } finally {
      setOptimizingImage(false);
      setUploadProgressStep('');
      setUploadProgressPercent(0);
    }
  };

  // Load existing event data in edit mode
  useEffect(() => {
    if (!editEventId) return;
    const loadEvent = async () => {
      setLoading(true);
      try {
        let data: any = null;
        try {
          const edgeRes = await lpuClient.fetchEventDetails(editEventId);
          if (edgeRes?.data) {
            data = edgeRes.data;
          }
        } catch {
          // Fall through to direct Supabase query
        }

        if (!data) {
          const { data: sbData, error: sbErr } = await supabase
            .from('events')
            .select('*, organizations(*), categories(*), event_content_sections(*), media_assets:banner_media_id(id, object_key, bucket)')
            .eq('id', editEventId)
            .maybeSingle();
          if (sbErr || !sbData) throw sbErr || new Error('Event not found');
          data = sbData;
        }

        setName(data.name || '');
        setDescription(data.description || '');
        setOrgId(data.organization_id || '');
        if (data.organizations?.name) {
          setManualOrgName(data.organizations.name);
        }
        setCategoryId(data.category_id || '');
        setSubcategoryId(data.subcategory_id || '');
        if (data.banner_media_id) {
          setBannerMediaId(data.banner_media_id);
        }
        if (data.banner_url) {
          setBannerUrl(data.banner_url);
        } else if (data.media_assets) {
          setBannerUrl(getOptimizedImage(data, 'event-banner'));
        }
        if (data.start_at) {
          const s = new Date(data.start_at);
          setStartDate(toLocalDateString(s));
          setStartTime(`${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`);
        }
        if (data.end_at) {
          const e = new Date(data.end_at);
          setEndDate(toLocalDateString(e));
          setEndTime(`${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`);
        }
        setVenueName(data.venue_name || '');
        setRegistrationMode(data.registration_mode || 'EXTERNAL');
        setExternalUrl(data.external_registration_url || '');
        setPricingType(data.pricing_type || 'FREE');
        setPriceAmount(data.price_amount || '');
        setRegistrationFormat(data.registration_format || 'INDIVIDUAL');
        setCapacityLimit(data.capacity_limit || '');
        if ((data as any).event_content_sections?.length > 0) {
          setSections(
            (data as any).event_content_sections.map((s: any) => ({
              section_type: s.section_type,
              title: s.title,
              content: typeof s.content === 'string' ? s.content : JSON.stringify(s.content),
              sort_order: s.sort_order
            }))
          );
        }
      } catch (err: any) {
        setError('Failed to load event for editing: ' + (err.message || ''));
      } finally {
        setLoading(false);
      }
    };
    loadEvent();
  }, [editEventId]);

  // Validation before step transition
  const validateStep = (step: number): boolean => {
    setError('');
    if (step === 1) {
      if (!name.trim()) {
        setError('Please enter an event name.');
        return false;
      }
      if (profile?.is_super_admin) {
        if (orgMode === 'MANUAL') {
          if (!manualOrgName.trim()) {
            setError('Please enter the host club / organization name.');
            return false;
          }
        } else {
          if (!orgId) {
            setError('Please select an organizing entity.');
            return false;
          }
        }
      } else {
        if (!orgId && !profile?.org_id) {
          setError('Please select an organizing entity.');
          return false;
        }
      }
      if (!categoryId) {
        setError('Please select a primary Category.');
        return false;
      }
    }
    if (step === 2) {
      const todayStr = toLocalDateString(new Date());
      if (!startDate) {
        setError('Please select an event Start Date.');
        return false;
      }
      if (!editEventId && startDate < todayStr) {
        setError('Event Start Date cannot be in the past (before today).');
        return false;
      }
      if (!startTime) {
        setError('Please specify an event Start Time.');
        return false;
      }
      if (!endDate) {
        setError('Please select an event End Date.');
        return false;
      }
      if (endDate < startDate) {
        setError('Event End Date cannot be before the Start Date.');
        return false;
      }
      if (!endTime) {
        setError('Please specify an event End Time.');
        return false;
      }
      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(`${endDate}T${endTime}`);
      if (endDateTime <= startDateTime) {
        setError('Event end date & time must be strictly after the start date & time.');
        return false;
      }
    }
    if (step === 3) {
      if (!venueName.trim()) {
        setError('Please enter the venue / auditorium name.');
        return false;
      }
    }
    if (step === 5) {
      if (pricingType === 'PAID' && !externalUrl.trim()) {
        setError('Please enter the ticket booking / registration redirect link.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 6));
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Submit to Supabase
  const handlePublish = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(5)) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    let effectiveOrgId = orgId || profile?.org_id || organizations[0]?.id;

    if (profile?.is_super_admin && orgMode === 'MANUAL') {
      const cleanOrgName = manualOrgName.trim();
      if (!cleanOrgName) {
        setError('Please enter the host club / organization name.');
        setSaving(false);
        return;
      }

      // Check if matches an existing organization in memory (case-insensitive)
      const existingMatch = organizations.find(
        (o) => o.name.trim().toLowerCase() === cleanOrgName.toLowerCase()
      );

      if (existingMatch?.id) {
        effectiveOrgId = existingMatch.id;
      } else {
        try {
          // Check DB to see if it already exists
          const { data: dbExisting } = await supabase
            .from('organizations')
            .select('id, name')
            .ilike('name', cleanOrgName)
            .maybeSingle();

          if (dbExisting?.id) {
            effectiveOrgId = dbExisting.id;
          } else {
            // Create new organization
            const { data: createdOrg, error: createErr } = await supabase
              .from('organizations')
              .insert({
                name: cleanOrgName,
                is_active: true
              })
              .select('id, name')
              .single();

            if (createErr) {
              if (createErr.code === '23505') {
                const { data: retryOrg } = await supabase
                  .from('organizations')
                  .select('id, name')
                  .ilike('name', cleanOrgName)
                  .maybeSingle();
                if (retryOrg?.id) {
                  effectiveOrgId = retryOrg.id;
                } else {
                  throw new Error('An organization with this name already exists.');
                }
              } else {
                throw new Error(`Failed to create club "${cleanOrgName}": ${createErr.message}`);
              }
            } else if (createdOrg?.id) {
              effectiveOrgId = createdOrg.id;
              setOrganizations((prev) => [createdOrg, ...prev]);
              setOrgId(createdOrg.id);
            }
          }
        } catch (orgErr: any) {
          console.error('Error ensuring organization:', orgErr);
          setError(orgErr.message || 'Failed to resolve organization.');
          setSaving(false);
          return;
        }
      }
    }

    const startIso = new Date(`${startDate}T${startTime}`).toISOString();
    const endIso = new Date(`${endDate}T${endTime}`).toISOString();

    const isExternal = pricingType === 'PAID' || !!externalUrl.trim();

    const payload: PublishEventPayload = {
      organization_id: effectiveOrgId,
      name: name.trim(),
      description: description.trim() || name.trim(),
      category_id: categoryId,
      subcategory_id: subcategoryId || null,
      banner_media_id: bannerMediaId || null,
      start_at: startIso,
      end_at: endIso,
      venue_name: venueName.trim(),
      registration_mode: isExternal ? 'EXTERNAL' : 'NONE',
      external_registration_url: isExternal ? externalUrl.trim() : null,
      pricing_type: pricingType,
      price_amount: pricingType === 'PAID' ? Number(priceAmount) || 0 : 0,
      registration_format: registrationFormat || 'INDIVIDUAL',
      capacity_limit: capacityLimit ? Number(capacityLimit) : null,
    };

    try {
      if (editEventId) {
        const { error: editErr } = await lpuClient.editEvent(editEventId, payload, sections);
        if (editErr) throw editErr;
        setSuccess('Event updated successfully!');
      } else {
        const { error: pubErr } = await lpuClient.publishEvent(payload, sections);
        if (pubErr) throw pubErr;
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch (e) {}
        setSuccess('Event published live to LPU Events platform!');
      }
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (err: any) {
      console.error('Publish error:', err);
      setError('Publication failed: ' + (err.message || 'Please verify form fields and try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold">Loading event configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 select-text" style={{ overscrollBehaviorX: 'none' }}>
      {/* Draft Restored Notification Banner */}
      {!editEventId && draftRestored && (
        <div className="flex items-center justify-between p-3 px-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">inventory_2</span>
            <span>Your unsaved event draft was automatically restored.</span>
          </div>
          <button
            type="button"
            onClick={handleClearDraft}
            className="px-3 py-1 text-[11px] font-bold rounded-lg bg-emerald-200/60 hover:bg-emerald-300/60 dark:bg-emerald-900/60 dark:hover:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100 transition-colors cursor-pointer"
          >
            Clear Draft
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-xs font-bold text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] mb-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Events
          </button>
          <h2 className="text-2xl md:text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
            {editEventId ? 'Edit Event' : 'Create New Event'}
          </h2>
        </div>
        <span className="text-xs font-bold px-3 py-1 bg-[#fee3d8] dark:bg-[#3d2d26] text-[#a04100] dark:text-[#ffb693] rounded-full border border-[#e2bfb0] dark:border-[#5a4136]">
          Step {currentStep} of {steps.length}
        </span>
      </div>

      {/* Stepper Progression Bar */}
      <div className="bg-white dark:bg-[#261812] rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] p-4 md:p-6 shadow-sm overflow-x-auto">
        <div className="flex justify-between items-center min-w-[500px] relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[#fee3d8] dark:bg-[#3d2d26] -z-10 rounded-full" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#ff6b00] -z-10 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((s) => {
            const isDone = s.num < currentStep;
            const isCurrent = s.num === currentStep;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num < currentStep || validateStep(currentStep)) {
                    setCurrentStep(s.num);
                  }
                }}
                className="flex flex-col items-center gap-1.5 focus:outline-none"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white dark:ring-[#261812] transition-all ${
                    isCurrent
                      ? 'bg-[#ff6b00] text-white shadow-md scale-110'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#fee3d8] dark:bg-[#3d2d26] text-[#5a4136] dark:text-[#ffb693]'
                  }`}
                >
                  {isDone ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : (
                    s.num
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-tight ${
                    isCurrent ? 'text-[#ff6b00] font-bold' : 'text-[#5a4136] dark:text-[#ffb693]'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center justify-between text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="hover:opacity-70">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 text-xs font-semibold shadow-sm">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{success}</span>
        </div>
      )}

      {/* Dynamic Form Step Content */}
      <div className="bg-white dark:bg-[#261812] rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] p-6 md:p-8 shadow-sm space-y-6">
        {/* STEP 1: BASIC INFO */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Basic Event Information
              </h3>
              <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-0.5">
                Set up the core title, organizing entity, and category classification.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-1.5">
                  Event Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. One World Global Cultural Fest 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm"
                  required
                />
              </div>

              {/* Organization Picker (Super Admin dropdown / manual entry / Organizer display) */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider">
                    Host Organization / Club *
                  </label>
                  {profile?.is_super_admin && (
                    <div className="inline-flex items-center bg-[#fee3d8]/70 dark:bg-[#3d2d26] p-0.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136]">
                      <button
                        type="button"
                        onClick={() => setOrgMode('SELECT')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                          orgMode === 'SELECT'
                            ? 'bg-white dark:bg-[#261812] text-[#ff6b00] shadow-sm'
                            : 'text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">format_list_bulleted</span>
                        <span>Select Existing</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrgMode('MANUAL')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                          orgMode === 'MANUAL'
                            ? 'bg-white dark:bg-[#261812] text-[#ff6b00] shadow-sm'
                            : 'text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">edit_square</span>
                        <span>Enter Manually</span>
                      </button>
                    </div>
                  )}
                </div>

                {profile?.is_super_admin ? (
                  orgMode === 'SELECT' ? (
                    <div>
                      <select
                        value={orgId}
                        onChange={(e) => setOrgId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm font-medium"
                      >
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1">
                        Select from existing registered clubs, or click <strong>Enter Manually</strong> above to type a custom name.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#ff6b00]">
                          corporate_fare
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Robotics Innovation Club, Dance Society, etc."
                          value={manualOrgName}
                          onChange={(e) => setManualOrgName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm font-medium"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1">
                        Type any custom club / organization name. If not already registered, it will be automatically created.
                      </p>
                    </div>
                  )
                ) : (
                  <div>
                    <div className="px-4 py-2.5 rounded-lg bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-sm font-bold text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#ff6b00]">corporate_fare</span>
                      <span>{profile?.org_name || 'My Organization'}</span>
                      <span className="ml-auto text-[11px] text-[#8c6b5d] dark:text-[#ffb693] font-normal flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        Locked to your organization
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-1.5">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    disabled={categories.length === 0}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm disabled:opacity-50"
                  >
                    {categories.length === 0 ? (
                      <option value="">Loading categories...</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-1.5">
                    Subcategory *
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    disabled={subcategories.length === 0}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm disabled:opacity-50"
                  >
                    {subcategories.length === 0 ? (
                      <option value="">No subcategories available</option>
                    ) : (
                      subcategories.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Short Description (For Cards & Previews) */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[17px] text-[#ff6b00]">short_text</span>
                      <span>Short Description (Summary for Cards & Previews) *</span>
                    </label>
                    <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-0.5 font-normal">
                      Brief 1–3 sentence overview shown on event cards & banners. (Detailed sections are configured in <strong>Step 4: Content</strong>).
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Quick Formatting Helpers */}
                    <button
                      type="button"
                      title="Insert Bullet Point"
                      onClick={() => {
                        setDescription((prev) => (prev ? prev + '\n• ' : '• '));
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] transition-colors cursor-pointer"
                    >
                      • Bullet
                    </button>
                    <button
                      type="button"
                      title="Insert Key Highlights"
                      onClick={() => {
                        setDescription((prev) => (prev ? prev + '\n\n✨ Key Highlights:\n- ' : '✨ Key Highlights:\n- '));
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] transition-colors cursor-pointer"
                    >
                      ✨ Highlights
                    </button>
                    
                    {/* Expand/Collapse Height Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] hover:bg-[#ff6b00] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isDescExpanded ? 'unfold_less' : 'unfold_more'}
                      </span>
                      <span>{isDescExpanded ? 'Compact' : 'Expand'}</span>
                    </button>
                  </div>
                </div>

                {/* Auto-Expanding Textarea */}
                <AutoExpandingTextarea
                  minHeight={isDescExpanded ? 240 : 110}
                  placeholder="Write a brief 1–3 sentence summary to introduce your event on cards, banners, and search previews..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
                
                <div className="flex items-center justify-between text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                  <span>Short overview for cards & feeds • Detailed sections in Step 4</span>
                  <span>{(description || '').length} characters</span>
                </div>
              </div>

              {/* Event Banner Image Upload (File based - No URL) */}
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[17px] text-[#ff6b00]">image</span>
                    <span>Event Banner Image</span>
                  </span>
                  <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">HD 16:9 (Auto-Enhanced WebP)</span>
                </label>

                {optimizingImage ? (
                  <div className="w-full rounded-2xl border-2 border-dashed border-[#ff6b00]/40 bg-[#fff8f6] dark:bg-[#1a120e] p-6 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
                    <div className="text-center w-full max-w-xs space-y-2">
                      <p className="text-xs font-bold text-[#261812] dark:text-[#ffede6]">
                        {uploadProgressStep || 'Processing Image...'}
                      </p>
                      {/* Animated Progress Bar */}
                      <div className="w-full bg-[#fee3d8] dark:bg-[#3d2d26] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#ff6b00] h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgressPercent || 30}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">
                        Cloudflare R2 Object Pipeline • Auto-Enhanced WebP
                      </p>
                    </div>
                  </div>
                ) : bannerUrl ? (
                  <div className="w-full rounded-2xl overflow-hidden border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] relative group">
                    {/* Multi-Slot Preview Selector */}
                    {slotPreviews && (
                      <div className="p-2.5 bg-[#fee3d8]/80 dark:bg-[#2d1e17] border-b border-[#e2bfb0]/80 dark:border-[#5a4136] flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#5a4136] dark:text-[#ffb693] px-1 font-heading">
                            Auto Synthesized Slots:
                          </span>
                          {(['card', 'banner', 'thumb'] as const).map((slotKey) => (
                            <button
                              key={slotKey}
                              type="button"
                              onClick={() => setActiveSlotPreview(slotKey)}
                              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                activeSlotPreview === slotKey
                                  ? 'bg-[#ff6b00] text-white shadow-sm'
                                  : 'bg-white/80 dark:bg-black/40 text-[#5a4136] dark:text-[#ffede6] hover:bg-white dark:hover:bg-black/60 border border-[#e2bfb0]/40 dark:border-white/10'
                              }`}
                            >
                              {slotKey === 'card' ? 'Event Card (16:9)' : slotKey === 'banner' ? 'Details Banner (2.4:1)' : 'Thumbnail (1:1)'}
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Full Cover • Stretched Edge-to-Edge
                        </span>
                      </div>
                    )}

                    <div className={`w-full overflow-hidden relative flex items-center justify-center bg-black/90 ${
                      activeSlotPreview === 'thumb'
                        ? 'h-52 max-w-[208px] mx-auto rounded-xl my-2 border border-white/10'
                        : activeSlotPreview === 'banner'
                        ? 'h-44 sm:h-52'
                        : 'h-48 sm:h-60'
                    }`}>
                      <img
                        src={(slotPreviews && slotPreviews[activeSlotPreview]) || bannerUrl}
                        alt="Event Banner Preview"
                        className="w-full h-full object-fill"
                        style={{ objectFit: 'fill' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      {imageStats && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-extrabold text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>HD WebP • Saved {imageStats.savings}% ({(imageStats.optimizedSize / 1024).toFixed(0)} KB)</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white dark:bg-[#261812] flex items-center justify-between border-t border-[#e2bfb0]/60 dark:border-[#5a4136]/60">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-[#ff6b00]">check_circle</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#261812] dark:text-[#ffede6] truncate max-w-[200px]">
                            {bannerFileName || 'Custom Event Banner'}
                          </span>
                          {imageStats && (
                            <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">
                              {imageStats.width} × {imageStats.height} px • WebP
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] transition-colors cursor-pointer flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">refresh</span>
                          <span>Change</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setBannerUrl('');
                            setBannerFileName('');
                            setBannerMediaId(null);
                            setSlotPreviews(null);
                            setImageStats(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-[#e2bfb0] dark:border-[#5a4136] hover:border-[#ff6b00] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#fff8f6] dark:bg-[#1a120e] group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-[#fee3d8] dark:bg-[#3d2d26] flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-[26px] text-[#ff6b00]">add_photo_alternate</span>
                    </div>
                    <p className="text-sm font-bold text-[#261812] dark:text-[#ffede6]">
                      Click to upload banner image
                    </p>
                    <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                      Auto-enhanced & compressed to WebP (JPG, PNG, WebP up to 10MB)
                    </p>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SCHEDULE */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Event Schedule & Timings
              </h3>
              <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-0.5">
                Set the beginning and conclusion of the event (Today or future dates only).
              </p>
            </div>

            {/* 4 Fields Grid with Custom Styled Date & Time Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {/* 1. Start Date */}
              <CustomDatePicker
                label="Start Date *"
                subtext="Calendar date when the event begins"
                icon="event"
                required={true}
                value={startDate}
                minDate={!editEventId ? toLocalDateString(new Date()) : undefined}
                onChange={(val) => {
                  setStartDate(val);
                  if (!endDate || endDate < val) {
                    setEndDate(val);
                  }
                }}
              />

              {/* 2. End Date */}
              <CustomDatePicker
                label="End Date *"
                subtext="Calendar date when the event concludes"
                icon="event_available"
                required={true}
                value={endDate}
                minDate={startDate || (!editEventId ? toLocalDateString(new Date()) : undefined)}
                onChange={(val) => setEndDate(val)}
              />

              {/* 3. Start Time */}
              <CustomTimePicker
                label="Start Time *"
                subtext="Doors open / Event session begins"
                icon="alarm"
                required={true}
                value={startTime}
                onChange={(val) => setStartTime(val)}
              />

              {/* 4. End Time */}
              <CustomTimePicker
                label="End Time *"
                subtext="Session wrap-up / Event conclusion time"
                icon="alarm_on"
                required={true}
                value={endTime}
                onChange={(val) => setEndTime(val)}
              />
            </div>

            {/* Live Formatted Schedule Preview */}
            {startDate && startTime && (
              <div className="p-3.5 px-4 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] flex items-center gap-3">
                <span className="material-symbols-outlined text-[#ff6b00] text-[20px]">event_note</span>
                <div className="text-xs">
                  <span className="font-bold text-[#261812] dark:text-[#ffede6]">Schedule Overview: </span>
                  <span className="text-[#ff6b00] font-bold">
                    {new Date(`${startDate}T${startTime}`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at {startTime}
                    {endDate && endTime ? ` ➔ ${new Date(`${endDate}T${endTime}`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${endTime}` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: VENUE */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="pb-4 border-b border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Campus Venue & Location
              </h3>
              <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-0.5">
                Specify where on campus this event will be hosted.
              </p>
            </div>

            {/* Venue Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-[#ff6b00]">location_on</span>
                  <span>Venue Name *</span>
                </span>
                <span className="text-[10px] text-[#ff6b00] font-bold">Required</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Shanti Devi Mittal Auditorium (Block 32)"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-sm font-medium outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 transition-all"
                required
              />
            </div>

            {/* Quick Presets Row */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                Quick Selection:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setVenueName('Shanti Devi Mittal Auditorium');
                    setShowBlockSelect(false);
                  }}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    venueName === 'Shanti Devi Mittal Auditorium'
                      ? 'border-[#ff6b00] bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] shadow-sm'
                      : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00]'
                  }`}
                >
                  📍 Shanti Devi Mittal Auditorium
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVenueName('Baldev Raj Mittal Unipolis');
                    setShowBlockSelect(false);
                  }}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    venueName === 'Baldev Raj Mittal Unipolis'
                      ? 'border-[#ff6b00] bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] shadow-sm'
                      : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00]'
                  }`}
                >
                  📍 Baldev Raj Mittal Unipolis
                </button>
                <button
                  type="button"
                  onClick={() => setShowBlockSelect(!showBlockSelect)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    showBlockSelect
                      ? 'border-[#ff6b00] bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] shadow-sm'
                      : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00]'
                  }`}
                >
                  🏢 Choose Block & Room {showBlockSelect ? '▲' : '▼'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBlockSelect(false);
                    setVenueName('');
                  }}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    !showBlockSelect && venueName !== 'Shanti Devi Mittal Auditorium' && venueName !== 'Baldev Raj Mittal Unipolis'
                      ? 'border-[#ff6b00] bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] shadow-sm'
                      : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00]'
                  }`}
                >
                  📍 Other
                </button>
              </div>
            </div>

            {/* Block & Room Selector (Toggled cleanly) */}
            {showBlockSelect && (
              <div className="p-4 rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] space-y-3 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1">
                      Select Block
                    </label>
                    <select
                      value={selectedBlock}
                      onChange={(e) => {
                        const blk = e.target.value;
                        setSelectedBlock(blk);
                        if (blk) {
                          const composed = roomNumber.trim() ? `${blk}, ${roomNumber.trim()}` : blk;
                          setVenueName(composed);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-[#261812] dark:text-[#ffede6] text-xs font-medium outline-none focus:border-[#ff6b00] cursor-pointer"
                    >
                      <option value="">-- Choose Block --</option>
                      <option value="Block 14">Block 14</option>
                      <option value="Block 28">Block 28</option>
                      <option value="Block 29">Block 29</option>
                      <option value="Block 32">Block 32</option>
                      <option value="Block 33">Block 33</option>
                      <option value="Block 34">Block 34</option>
                      <option value="Block 36">Block 36</option>
                      <option value="Block 37">Block 37</option>
                      <option value="Block 38">Block 38</option>
                      <option value="Block 55">Block 55</option>
                      <option value="Block 56">Block 56</option>
                      <option value="Block 57">Block 57</option>
                      <option value="Block 58">Block 58</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1">
                      Room / Lab No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Room 204 / Seminar Hall"
                      value={roomNumber}
                      onChange={(e) => {
                        const rm = e.target.value;
                        setRoomNumber(rm);
                        if (selectedBlock) {
                          const composed = rm.trim() ? `${selectedBlock}, ${rm.trim()}` : selectedBlock;
                          setVenueName(composed);
                        } else {
                          setVenueName(rm);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-[#261812] dark:text-[#ffede6] text-xs font-medium outline-none focus:border-[#ff6b00]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: GUIDELINES & CONTENT SECTIONS */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-[#e2bfb0]/50 dark:border-[#5a4136]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[24px] text-[#ff6b00]">article</span>
                  <span>Event Guidelines & Content Sections</span>
                </h3>
                <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                  Structure your event details with expandable sections for rules, rewards, rounds, and eligibility.
                </p>
              </div>

              {/* Action: Add Custom Section */}
              <button
                type="button"
                onClick={() => {
                  const newIdx = sections.length;
                  setSections([
                    ...sections,
                    {
                      section_type: 'CUSTOM',
                      title: 'New Section',
                      content: '',
                      sort_order: newIdx
                    }
                  ]);
                  setExpandedSections((prev) => [...prev, newIdx]);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#ff6b00] text-white hover:bg-[#e05e00] shadow-md shadow-[#ff6b00]/20 flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Add Section</span>
              </button>
            </div>

            {/* Quick Template Section Presets */}
            <div className="p-3.5 rounded-2xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] space-y-2">
              <span className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-[#ff6b00]">auto_awesome</span>
                <span>Quick Add Templates:</span>
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { title: '🏆 Prize Pool & Rewards', desc: 'Cash prizes, certificates & medals' },
                  { title: '⚖️ Rules & Regulations', desc: 'Eligibility, team size, code of conduct' },
                  { title: '🎓 Eligibility & Criteria', desc: 'Who can participate' },
                  { title: '📋 Event Rounds & Timeline', desc: 'Round 1, Round 2, Final Presentation' },
                  { title: '❓ FAQs & Contact Info', desc: 'Frequently asked questions' }
                ].map((tpl) => (
                  <button
                    key={tpl.title}
                    type="button"
                    onClick={() => {
                      const newIdx = sections.length;
                      setSections([
                        ...sections,
                        {
                          section_type: 'CUSTOM',
                          title: tpl.title,
                          content: '',
                          sort_order: newIdx
                        }
                      ]);
                      setExpandedSections((prev) => [...prev, newIdx]);
                    }}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] hover:text-[#ff6b00] transition-colors cursor-pointer"
                  >
                    + {tpl.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable Section Cards List */}
            <div className="space-y-4">
              {sections.map((sec, idx) => {
                const isExpanded = expandedSections.includes(idx);
                const charCount = (sec.content || '').length;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
                      isExpanded
                        ? 'border-[#ff6b00] ring-2 ring-[#ff6b00]/15 bg-white dark:bg-[#261812]'
                        : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] hover:border-[#ff6b00]/60'
                    }`}
                  >
                    {/* Collapsible Card Header Bar */}
                    <div
                      onClick={() => {
                        setExpandedSections((prev) =>
                          prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                        );
                      }}
                      className="px-5 py-4 flex items-center justify-between gap-3 cursor-pointer select-none border-b border-transparent hover:bg-[#fee3d8]/30 dark:hover:bg-[#3d2d26]/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Section Number Pill */}
                        <div className="w-8 h-8 rounded-xl bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] font-black text-xs flex items-center justify-center flex-shrink-0">
                          {String(idx + 1).padStart(2, '0')}
                        </div>

                        {/* Title Display */}
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-[#261812] dark:text-[#ffede6] truncate font-['Outfit']">
                            {sec.title || 'Untitled Section'}
                          </h4>
                          <span className="text-[11px] text-[#5a4136] dark:text-[#ffb693] font-medium">
                            {charCount > 0 ? `${charCount} characters filled` : 'Empty • Click to add content'}
                          </span>
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Reorder Buttons */}
                        {idx > 0 && (
                          <button
                            type="button"
                            title="Move Section Up"
                            onClick={() => {
                              const updated = [...sections];
                              const temp = updated[idx];
                              updated[idx] = updated[idx - 1];
                              updated[idx - 1] = temp;
                              setSections(updated);
                            }}
                            className="p-1.5 rounded-lg text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                          </button>
                        )}
                        {idx < sections.length - 1 && (
                          <button
                            type="button"
                            title="Move Section Down"
                            onClick={() => {
                              const updated = [...sections];
                              const temp = updated[idx];
                              updated[idx] = updated[idx + 1];
                              updated[idx + 1] = temp;
                              setSections(updated);
                            }}
                            className="p-1.5 rounded-lg text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                          </button>
                        )}

                        {/* Delete Button */}
                        {sections.length > 1 && (
                          <button
                            type="button"
                            title="Delete Section"
                            onClick={() => {
                              setSections(sections.filter((_, i) => i !== idx));
                              setExpandedSections((prev) => prev.filter((i) => i !== idx));
                            }}
                            className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}

                        {/* Accordion Expand / Collapse Chevron */}
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedSections((prev) =>
                              prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                            );
                          }}
                          className={`p-1.5 rounded-lg text-[#ff6b00] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-transform duration-200 cursor-pointer ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        >
                          <span className="material-symbols-outlined text-[22px]">expand_more</span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Body */}
                    {isExpanded && (
                      <div className="p-5 pt-2 border-t border-[#e2bfb0]/50 dark:border-[#5a4136]/50 space-y-4 animate-fadeIn">
                        {/* Section Title Input */}
                        <div>
                          <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Section Title *</span>
                            <span className="text-[10px] text-[#ff6b00] font-bold">Visible on Event Page</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Prize Pool, Rules & Regulations, Eligibility Criteria..."
                            value={sec.title}
                            onChange={(e) => {
                              const updated = [...sections];
                              updated[idx].title = e.target.value;
                              setSections(updated);
                            }}
                            className="w-full px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-sm font-bold outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 transition-all"
                          />
                        </div>

                        {/* Section Content with Quick Formatting Toolbar */}
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider">
                              Section Details & Guidelines *
                            </label>

                            {/* Formatting Helpers */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                type="button"
                                title="Insert Bullet Point"
                                onClick={() => {
                                  const updated = [...sections];
                                  updated[idx].content = (sec.content ? sec.content + '\n' : '') + '• ';
                                  setSections(updated);
                                }}
                                className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] transition-colors cursor-pointer"
                              >
                                • Bullet List
                              </button>
                              <button
                                type="button"
                                title="Insert Numbered Step"
                                onClick={() => {
                                  const updated = [...sections];
                                  const lines = (sec.content || '').split('\n');
                                  const nextNum = lines.filter((l: string) => /^\d+\./.test(l.trim())).length + 1;
                                  updated[idx].content = (sec.content ? sec.content + '\n' : '') + `${nextNum}. `;
                                  setSections(updated);
                                }}
                                className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] transition-colors cursor-pointer"
                              >
                                1. Number List
                              </button>
                              <button
                                type="button"
                                title="Insert Important Note"
                                onClick={() => {
                                  const updated = [...sections];
                                  updated[idx].content = (sec.content ? sec.content + '\n' : '') + '📌 Note: ';
                                  setSections(updated);
                                }}
                                className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] transition-colors cursor-pointer"
                              >
                                📌 Note
                              </button>
                              <button
                                type="button"
                                title="Insert Prize Structure"
                                onClick={() => {
                                  const updated = [...sections];
                                  updated[idx].content = (sec.content ? sec.content + '\n' : '') + '🥇 1st Prize: ₹\n🥈 2nd Prize: ₹\n🥉 3rd Prize: ₹';
                                  setSections(updated);
                                }}
                                className="px-2 py-1 text-[11px] font-bold rounded-md bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00] transition-colors cursor-pointer"
                              >
                                🥇 Prizes
                              </button>
                            </div>
                          </div>

                          {/* Auto-Expanding Textarea to fit all details dynamically */}
                          <AutoExpandingTextarea
                            minHeight={180}
                            placeholder="Write comprehensive guidelines, rules, rewards, or steps for participants... (Supports markdown, line breaks, and bullet points)"
                            value={sec.content}
                            onChange={(e) => {
                              const updated = [...sections];
                              updated[idx].content = e.target.value;
                              setSections(updated);
                            }}
                          />

                          <div className="flex items-center justify-between text-[11px] text-[#5a4136] dark:text-[#ffb693] pt-1">
                            <span>Auto-expands to fit all lines • Markdown & list formatting supported</span>
                            <span>{charCount} characters</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: PRICING & TICKET BOOKING */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
              <h3 className="text-xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[#ff6b00]">payments</span>
                <span>Event Pricing & Ticket Booking</span>
              </h3>
              <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                Select whether this event is Free or Paid, and provide the ticket booking link if paid.
              </p>
            </div>

            {/* Free vs Paid Toggle Cards */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider">
                Is this event Free or Paid? *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Free Option Card */}
                <button
                  type="button"
                  onClick={() => {
                    setPricingType('FREE');
                    setPriceAmount('');
                    setExternalUrl('');
                  }}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 ${
                    pricingType === 'FREE'
                      ? 'border-[#ff6b00] bg-[#fee3d8]/40 dark:bg-[#3d2d26]/40 ring-2 ring-[#ff6b00]/20 shadow-md'
                      : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] hover:border-[#ff6b00]/60'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      pricingType === 'FREE'
                        ? 'bg-[#ff6b00] text-white'
                        : 'bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">confirmation_number</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#261812] dark:text-[#ffede6]">Free Entry</h4>
                      {pricingType === 'FREE' && (
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          SELECTED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                      No ticket purchase required. Open for all students / attendees.
                    </p>
                  </div>
                </button>

                {/* Paid Option Card */}
                <button
                  type="button"
                  onClick={() => setPricingType('PAID')}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-4 ${
                    pricingType === 'PAID'
                      ? 'border-[#ff6b00] bg-[#fee3d8]/40 dark:bg-[#3d2d26]/40 ring-2 ring-[#ff6b00]/20 shadow-md'
                      : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] hover:border-[#ff6b00]/60'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      pricingType === 'PAID'
                        ? 'bg-[#ff6b00] text-white'
                        : 'bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">sell</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#261812] dark:text-[#ffede6]">Paid Event</h4>
                      {pricingType === 'PAID' && (
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-[#ff6b00] text-white">
                          SELECTED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                      Requires participants to book tickets via booking redirect link.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Paid Event Details (Link to book ticket & Optional Price below) */}
            {pricingType === 'PAID' && (
              <div className="p-5 rounded-2xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#ff6b00]/40 space-y-4 animate-fadeIn">
                {/* Booking Link Field (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[17px] text-[#ff6b00]">link</span>
                      <span>Booking Redirect Link *</span>
                    </span>
                    <span className="text-[10px] text-[#ff6b00] font-bold">Required</span>
                  </label>
                  <input
                    type="url"
                    placeholder="e.g. https://unstop.com/... or https://forms.gle/..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-[#261812] dark:text-[#ffede6] text-sm font-medium outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 transition-all"
                    required
                  />
                  <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1.5">
                    Students will be directly redirected to this link when they click <strong>"Book Ticket"</strong> on the event page.
                  </p>
                </div>

                {/* Ticket Price Field (Optional - Below booking link) */}
                <div>
                  <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[17px] text-[#ff6b00]">sell</span>
                      <span>Ticket Price in INR ₹</span>
                    </span>
                    <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">Optional</span>
                  </label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#ff6b00]">₹</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 99 or 199 (Optional)"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value ? Number(e.target.value) : '')}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-[#261812] dark:text-[#ffede6] text-sm font-medium outline-none focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1">
                    Displays price badge on event card if specified.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 6: REVIEW & PUBLISH */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Review & Confirm Publication
              </h3>
              <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-0.5">
                Verify all details before publishing this event live to the university.
              </p>
            </div>

            <div className="bg-[#fff8f6] dark:bg-[#1a120e] rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] p-6 space-y-4 text-xs">
              <div className="flex justify-between items-start pb-3 border-b border-[#e2bfb0]/60 dark:border-[#5a4136]/60">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00]">
                    {selectedCategory?.name || 'Category'}
                  </span>
                  <h4 className="text-xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mt-1">
                    {name || 'Untitled Event'}
                  </h4>
                  <p className="text-[#5a4136] dark:text-[#ffb693] mt-0.5">
                    Hosted by:{' '}
                    <strong className="text-[#ff6b00]">
                      {profile?.is_super_admin && orgMode === 'MANUAL'
                        ? (manualOrgName.trim() || 'Custom Organization')
                        : (organizations.find((o) => o.id === orgId)?.name || profile?.org_name || 'Organization')}
                    </strong>
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold rounded-full">
                  {pricingType === 'FREE' ? 'FREE ENTRY' : `₹ ${priceAmount || 0}`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[#5a4136] dark:text-[#ffb693] block">Date & Time:</span>
                  <p className="font-bold text-[#261812] dark:text-[#ffede6]">
                    {startDate && startTime
                      ? `${new Date(`${startDate}T${startTime}`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${startTime}`
                      : 'Not Set'}{' '}
                    &rarr;{' '}
                    {endDate && endTime
                      ? `${new Date(`${endDate}T${endTime}`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} at ${endTime}`
                      : 'Not Set'}
                  </p>
                </div>

                <div>
                  <span className="text-[#5a4136] dark:text-[#ffb693] block">Venue / Location:</span>
                  <p className="font-bold text-[#261812] dark:text-[#ffede6]">
                    📍 {venueName || 'Campus Venue'}
                  </p>
                </div>
              </div>

              {description && (
                <div className="pt-2 border-t border-[#e2bfb0]/40">
                  <span className="text-[#5a4136] dark:text-[#ffb693] block mb-1">Short Description (Card Summary):</span>
                  <p className="text-[#261812] dark:text-[#ffede6]">{description}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Navigation Bar */}
      <div className="bg-white dark:bg-[#261812] rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] p-4 shadow-sm flex justify-between items-center sticky bottom-4 backdrop-blur-md">
        <button
          type="button"
          onClick={currentStep === 1 ? onCancel : handleBack}
          className="px-5 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>{currentStep === 1 ? 'Cancel' : 'Previous Step'}</span>
        </button>

        <div className="flex gap-3">
          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 rounded-lg bg-[#ff6b00] hover:bg-[#a04100] text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
            >
              <span>Continue</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handlePublish}
              className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                  <span>{editEventId ? 'Save Changes' : 'Publish Event Live'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
