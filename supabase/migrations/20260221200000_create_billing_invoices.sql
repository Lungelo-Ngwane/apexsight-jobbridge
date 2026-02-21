create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  provider text not null default 'paystack',
  provider_reference text,
  invoice_number text not null,
  kind text not null check (kind in ('subscription', 'addon')),
  status text not null check (status in ('paid', 'pending', 'failed', 'refunded', 'void')),
  currency text not null default 'ZAR',
  amount_kobo bigint not null default 0,
  vat_kobo bigint not null default 0,
  total_kobo bigint not null default 0,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists billing_invoices_invoice_number_key
  on public.billing_invoices (invoice_number);

create unique index if not exists billing_invoices_provider_ref_kind_key
  on public.billing_invoices (provider, provider_reference, kind)
  where provider_reference is not null;

create index if not exists billing_invoices_employer_issued_at_idx
  on public.billing_invoices (employer_id, issued_at desc);

alter table public.billing_invoices enable row level security;

drop policy if exists "employers_select_own_billing_invoices" on public.billing_invoices;
create policy "employers_select_own_billing_invoices"
on public.billing_invoices
for select
using (
  exists (
    select 1
    from public.employer_profiles ep
    where ep.id = billing_invoices.employer_id
      and ep.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('billing-invoices', 'billing-invoices', false)
on conflict (id) do nothing;
