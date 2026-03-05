# Skills Seed (Large Catalog)

This project now includes a generator script:

- `supabase/scripts/generate_skills_seed.py`

It builds a large skills seed (1,000 to 3,000 rows) and writes SQL that is safe to re-run.

## 1) Generate the SQL file

From project root:

```powershell
python supabase/scripts/generate_skills_seed.py
```

Default output:

- `supabase/seed/skills_seed.sql`

Optional output to a migration file (recommended for `supabase db push`):

```powershell
python supabase/scripts/generate_skills_seed.py --output supabase/migrations/20260305160000_seed_skills_catalog.sql
```

## 2) Apply to Supabase

Use either approach:

1. SQL Editor:
- Open `supabase/seed/skills_seed.sql`
- Run it in Supabase SQL Editor

2. Migration flow:
- Generate directly into `supabase/migrations/...`
- Run:

```powershell
supabase db push
```

## Notes

- Seed is idempotent:
  - Existing skills are matched by case-insensitive `name` and category is updated.
  - Missing skills are inserted.
- Script enforces:
  - `name` max 150 chars
  - `category` max 100 chars
