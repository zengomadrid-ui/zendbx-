-- Add legacy_slug column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS legacy_slug VARCHAR(255);

-- Backup current slugs to legacy_slug
UPDATE projects SET legacy_slug = slug WHERE legacy_slug IS NULL;

-- Update slugs to clean versions
UPDATE projects SET slug = 'alice' WHERE id = '78eb077a-574e-46bc-8122-f4375dac2c65';
UPDATE projects SET slug = 'demo' WHERE id = '580c27a7-4f2e-4265-810e-1ba3adc9ec8d';
UPDATE projects SET slug = 'oath' WHERE id = '4bd5a846-2a88-4012-aa9f-c545d2d41e50';
UPDATE projects SET slug = 'pawansrikumar-in-gmail-com-s-project' WHERE id = '1aa79596-bbaf-4925-837f-428c02bcd8ba';
UPDATE projects SET slug = 'ramos-test-1' WHERE id = 'c0538580-b456-47e6-a47f-95b388d94d43';
UPDATE projects SET slug = 'rls-test-83552df6' WHERE id = '6bc97339-ae05-4c52-846e-40597c7e2e0a';
UPDATE projects SET slug = 'rls-test-cf34a642' WHERE id = '051110bc-9217-47a2-bc54-8af1c5278215';
UPDATE projects SET slug = 'rls-test-e44d4027' WHERE id = '41fda15a-b132-4a01-90fc-9dfac480abe1';

-- Collision group: test (3 projects)
UPDATE projects SET slug = 'test' WHERE id = '37a1e359-4045-406d-a79a-1e5982631c1d'; -- test
UPDATE projects SET slug = 'test-2' WHERE id = '6963d283-4a8e-4ac9-9870-bd3d1adc628c'; -- test 
UPDATE projects SET slug = 'test-3' WHERE id = 'f17e893d-3b9e-436d-aad1-1a1036579fd7'; -- test
UPDATE projects SET slug = 'test-alpha' WHERE id = '39c0e7a8-0535-4071-bc0a-5ba5b54c5f86';
UPDATE projects SET slug = 'test-app' WHERE id = '8518c1e3-a4d5-4253-b194-795b7116f9ce';
UPDATE projects SET slug = 'test-beta' WHERE id = '30ba5748-110e-44e7-ac0f-c2378b17b149';
UPDATE projects SET slug = 'test-todo-app' WHERE id = 'eee5183a-18ed-4fc2-91dd-9a35ecdefc76';
UPDATE projects SET slug = 'testing-app' WHERE id = '3fce9f34-d8ad-4fb1-911b-b59d224bab68';
UPDATE projects SET slug = 'tokens' WHERE id = '698351c1-bba1-493f-96ef-3587e06fdd9b';

-- Collision group: user (2 projects)
UPDATE projects SET slug = 'user' WHERE id = '4f181617-a248-4575-9b1a-3436fe7f3ad9'; -- user 
UPDATE projects SET slug = 'user-2' WHERE id = '21184796-8bd4-4243-ae5e-eb19b8fffc8c'; -- user 

-- Collision group: zen (2 projects)
UPDATE projects SET slug = 'zen' WHERE id = 'b1caaf69-5956-4ab3-90eb-ad23d0f5a6fa'; -- zen
UPDATE projects SET slug = 'zen-2' WHERE id = 'f179e884-7a60-467a-ab4f-6fece3e712f1'; -- zen
UPDATE projects SET slug = 'zen-project-testing' WHERE id = '63547f7e-c900-4046-9604-2cd88bd1ec93';
UPDATE projects SET slug = 'zen-test-1' WHERE id = '9fdd2f0d-c9f6-42a4-8b4b-b754c04651fa';
UPDATE projects SET slug = 'zendbx-commits-s-project' WHERE id = 'af14ba8f-679b-4a02-b216-c5a34ffaae35';

-- Collision group: zengo (2 projects)
UPDATE projects SET slug = 'zengo' WHERE id = '032e170a-5397-43cc-8e8d-294136773830'; -- zengo
UPDATE projects SET slug = 'zengo-2' WHERE id = '5eb21762-0c1b-4548-99f9-931d42687895'; -- zengo
UPDATE projects SET slug = 'zengo-1' WHERE id = '7121ceb0-9e97-4e37-bb1b-c674a565fb6a';
UPDATE projects SET slug = 'zengomadrid-ui-s-project' WHERE id = '31595bfb-80fa-4bc1-9b1b-3eee38b2f749';
UPDATE projects SET slug = 'zenhire' WHERE id = 'cca46242-1ca2-407b-a5d6-a171b6fba351';
UPDATE projects SET slug = 'zenith-base' WHERE id = 'ea6df596-a2b3-4014-bd62-28320ab230bc';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_legacy_slug ON projects(legacy_slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug_unique ON projects(slug);