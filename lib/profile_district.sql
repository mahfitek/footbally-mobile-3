-- Store the selected district (ilçe) alongside the existing city (şehir) field
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;
