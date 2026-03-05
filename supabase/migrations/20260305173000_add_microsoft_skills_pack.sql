-- Add Microsoft ecosystem skills (Power Platform, SharePoint, M365, Dynamics).
-- Safe to re-run.

with rows(name, category) as (
  values
    ('Microsoft 365', 'Microsoft'),
    ('Microsoft Teams', 'Microsoft'),
    ('Microsoft Entra ID', 'Microsoft'),
    ('Azure Active Directory', 'Microsoft'),
    ('Intune', 'Microsoft'),
    ('Microsoft Defender', 'Microsoft'),
    ('SharePoint', 'Microsoft'),
    ('SharePoint Online', 'Microsoft'),
    ('SharePoint Administration', 'Microsoft'),
    ('SharePoint Framework (SPFx)', 'Microsoft'),
    ('Power Platform', 'Microsoft'),
    ('Power Apps', 'Microsoft'),
    ('Power Automate', 'Microsoft'),
    ('Power BI', 'Microsoft'),
    ('Power BI DAX', 'Microsoft'),
    ('Power BI Data Modeling', 'Microsoft'),
    ('Power Query', 'Microsoft'),
    ('Dataverse', 'Microsoft'),
    ('Dynamics 365', 'Microsoft'),
    ('Dynamics 365 CRM', 'Microsoft'),
    ('Dynamics 365 Finance and Operations', 'Microsoft'),
    ('Microsoft Fabric', 'Microsoft'),
    ('Azure Data Factory', 'Microsoft'),
    ('Azure Synapse Analytics', 'Microsoft'),
    ('Azure Data Lake Storage', 'Microsoft'),
    ('Azure Logic Apps', 'Microsoft'),
    ('Azure Service Bus', 'Microsoft'),
    ('Azure Event Grid', 'Microsoft'),
    ('Microsoft Sentinel', 'Microsoft'),
    ('Windows 11', 'Microsoft'),
    ('Windows 10', 'Microsoft'),
    ('Exchange Online', 'Microsoft'),
    ('OneDrive for Business', 'Microsoft'),
    ('Planner', 'Microsoft'),
    ('Microsoft Project', 'Microsoft'),
    ('Microsoft Visio', 'Microsoft'),
    ('Excel', 'Microsoft'),
    ('Advanced Excel', 'Microsoft'),
    ('PivotTables', 'Microsoft'),
    ('Power Pivot', 'Microsoft'),
    ('VBA', 'Microsoft'),
    ('Office 365 Administration', 'Microsoft'),
    ('M365 Security', 'Microsoft'),
    ('M365 Compliance', 'Microsoft'),
    ('M365 Identity Management', 'Microsoft')
),
updated as (
  update public.skills s
  set category = left(rows.category, 100)::varchar(100)
  from rows
  where lower(s.name) = lower(rows.name)
  returning lower(s.name) as norm_name
)
insert into public.skills (name, category)
select
  left(rows.name, 150)::varchar(150),
  left(rows.category, 100)::varchar(100)
from rows
where not exists (
  select 1 from updated u where u.norm_name = lower(rows.name)
)
and not exists (
  select 1 from public.skills s where lower(s.name) = lower(rows.name)
);
