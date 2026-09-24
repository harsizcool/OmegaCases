-- Support: players open a ticket, admins answer it, both sides keep the thread.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other'
                 CHECK (category IN ('payment','account','trade','bug','report','other')),
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','answered','closed')),
  -- Kept on the ticket rather than counted from the thread, so the list can be
  -- ordered and filtered without reading every message.
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_for_user  BOOLEAN NOT NULL DEFAULT FALSE,
  unread_for_staff BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_queue
  ON public.support_tickets (status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  -- Who wrote it. NULL author_id means the account was deleted since; the
  -- message stays so the thread still reads in order.
  author_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  from_staff BOOLEAN NOT NULL DEFAULT FALSE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON public.support_messages (ticket_id, created_at);

-- Reads go through the anon key and writes happen in API routes with the service
-- role, which bypasses RLS. Support threads are private, so unlike the public
-- tables these get no read policy at all: only the API routes can see them.
DO $mig$
BEGIN
  EXECUTE 'ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY';
END
$mig$;

-- Whether the support page accepts new tickets at all, and the note shown above
-- the form. Admins change both from the admin panel.
INSERT INTO public.game_settings (key, value) VALUES
  ('support_enabled', 'true'),
  ('support_notice', '""')
ON CONFLICT (key) DO NOTHING;
