
-- Add attachment_url and auto_trigger columns to dispatch_queues
ALTER TABLE public.dispatch_queues
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS auto_trigger jsonb DEFAULT null;

-- Create storage bucket for dispatch attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispatch-attachments', 'dispatch-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to dispatch-attachments
CREATE POLICY "Authenticated users can upload dispatch attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dispatch-attachments');

-- Allow public read access
CREATE POLICY "Public read dispatch attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dispatch-attachments');
