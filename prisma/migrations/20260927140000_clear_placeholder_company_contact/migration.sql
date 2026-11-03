-- The company profile was seeded with a made-up phone number and address that then appeared in
-- every client email. Clear only those exact placeholder values; real details are left untouched.
UPDATE "company_profile" SET "phone" = '' WHERE "phone" = '+91 40 1234 5678';
UPDATE "company_profile" SET "address" = '' WHERE "address" = '123 Tech Park, Hitech City';
