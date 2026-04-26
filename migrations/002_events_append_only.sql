-- Запрет UPDATE/DELETE на events (INV-02 / rules.hard, acceptance iter 1)

CREATE OR REPLACE FUNCTION forbid_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only: UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_events_forbid_mutate ON events;
CREATE TRIGGER tr_events_forbid_mutate
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW
  EXECUTE PROCEDURE forbid_events_mutation();

COMMENT ON TABLE events IS 'append-only event store; mutations blocked by trigger tr_events_forbid_mutate';
