DO $$
DECLARE
  v_emails text[] := ARRAY['admin@mugec-ci.ci','inoceadmin@miprojet.local','adminmgec@mugec-ci.local'];
  v_email text;
BEGIN
  FOREACH v_email IN ARRAY v_emails LOOP
    UPDATE auth.users
       SET encrypted_password = crypt(encode(gen_random_bytes(24), 'base64'), gen_salt('bf')),
           updated_at = now()
     WHERE email = v_email
       AND encrypted_password = crypt('__ROTATE_ME__', encrypted_password);
  END LOOP;
END $$;