REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
ALTER FUNCTION public.set_updated_at() OWNER TO postgres;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;