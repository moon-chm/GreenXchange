CREATE OR REPLACE FUNCTION prevent_modify_append_only()
RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'growth_updates' AND TG_OP = 'UPDATE' THEN
        IF OLD.verification_status IN ('PENDING', 'MANUAL_REVIEW') AND 
           NEW.id = OLD.id AND NEW.plant_id = OLD.plant_id AND 
           NEW.image_url = OLD.image_url AND NEW.server_timestamp = OLD.server_timestamp THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'This table is append-only. General Updates and Deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;
