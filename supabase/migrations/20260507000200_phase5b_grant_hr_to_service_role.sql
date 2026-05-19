-- service_role needs USAGE on schema + ALL on objects to query through PostgREST
-- (default schema grants only apply to public; new schemas need explicit grant)

GRANT USAGE ON SCHEMA hr TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA hr TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA hr TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA hr TO service_role;

-- Future tables/sequences in hr also auto-granted (created by postgres role)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hr
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hr
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hr
  GRANT ALL ON ROUTINES TO service_role;

-- anon / authenticated stay blocked (no USAGE on schema = can't even reach RLS check)
