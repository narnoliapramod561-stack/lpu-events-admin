-- Create the pending_paid_event_requests view
DROP VIEW IF EXISTS public.pending_paid_event_requests;

CREATE VIEW public.pending_paid_event_requests AS
SELECT 
    e.id as event_id,
    e.title,
    e.slug,
    e.description,
    e.short_description,
    e.cover_image_url,
    e.venue,
    e.venue_address,
    e.starts_at,
    e.ends_at,
    e.registration_opens_at,
    e.registration_closes_at,
    e.is_free,
    e.registration_required,
    e.registration_type,
    e.registration_platform,
    e.registration_mode,
    e.max_tickets,
    e.terms_and_conditions,
    e.contact_email,
    e.contact_phone,
    e.created_at as event_created_at,
    e.submitted_for_approval_at,
    e.approval_status,
    p.full_name as organizer_name,
    p.email as organizer_email,
    c.name as category_name,
    sc.name as subcategory_name
FROM public.events e
JOIN public.profiles p ON e.organizer_id = p.id
LEFT JOIN public.categories c ON e.category_id = c.id
LEFT JOIN public.subcategories sc ON e.subcategory_id = sc.id
WHERE e.deleted_at IS NULL
  AND e.status = 'pending_approval'
  AND e.approval_status = 'pending';