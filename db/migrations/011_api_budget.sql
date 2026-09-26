-- Hourly call counts for /api/triage and /api/ask, shared by every server instance.
create table if not exists api_budget (
  hour timestamptz not null,
  route text not null,
  count integer not null default 0,
  primary key (hour, route)
);
