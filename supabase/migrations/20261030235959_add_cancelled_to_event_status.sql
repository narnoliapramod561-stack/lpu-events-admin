-- Add CANCELLED value to event_status enum before it is referenced
alter type public.event_status add value if not exists 'CANCELLED';
