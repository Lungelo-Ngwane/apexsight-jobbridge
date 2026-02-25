-- Backfill candidate_skills.skill_id where text skill matches skills.name.

with skill_lookup as (
  select
    id,
    lower(regexp_replace(name, '[^a-z0-9+#]', '', 'g')) as norm_name
  from public.skills
),
candidate_norm as (
  select
    cs.id,
    lower(regexp_replace(cs.skill, '[^a-z0-9+#]', '', 'g')) as norm_skill
  from public.candidate_skills cs
  where cs.skill_id is null
    and cs.skill is not null
)
update public.candidate_skills cs
set skill_id = sl.id
from candidate_norm cn
join skill_lookup sl on sl.norm_name = cn.norm_skill
where cs.id = cn.id
  and cs.skill_id is null;
