-- Reset MIPROJET super admin password and ensure email confirmed
UPDATE auth.users
SET 
  encrypted_password = crypt('@Massa29012020', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email = 'inoce@miprojet.local';