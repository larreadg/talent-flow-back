-- This is an empty migration.
-- Renombra el valor del enum sin perder datos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'VacanteEstado'
      AND e.enumlabel = 'cerrada'
  ) THEN
    ALTER TYPE "VacanteEstado" RENAME VALUE 'cerrada' TO 'finalizada';
  END IF;
END$$;
