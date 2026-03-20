
-- Add bot_training column to collaborators
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS bot_training text DEFAULT '';

-- Create whatsapp_bot_conversations table
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  contact_name text,
  contact_phone text NOT NULL,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS for whatsapp_bot_conversations
CREATE POLICY "Authenticated users can read whatsapp_bot_conversations"
  ON public.whatsapp_bot_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert whatsapp_bot_conversations"
  ON public.whatsapp_bot_conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update whatsapp_bot_conversations"
  ON public.whatsapp_bot_conversations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
