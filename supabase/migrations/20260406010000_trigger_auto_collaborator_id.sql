-- Trigger: auto-preencher collaborator_id em calls via phone match no consultant_lead_pool
CREATE OR REPLACE FUNCTION fn_auto_set_call_collaborator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.collaborator_id IS NULL AND NEW.destination_number IS NOT NULL THEN
    SELECT p.collaborator_id INTO NEW.collaborator_id
    FROM consultant_lead_pool p
    WHERE '55' || regexp_replace(p.phone_normalized, '[^0-9]', '', 'g')
        = regexp_replace(NEW.destination_number, '[^0-9]', '', 'g')
      AND p.collaborator_id IS NOT NULL
    ORDER BY p.last_call_at DESC NULLS LAST
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_call_collaborator ON calls;
CREATE TRIGGER trg_auto_set_call_collaborator
  BEFORE INSERT ON calls
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_set_call_collaborator();
