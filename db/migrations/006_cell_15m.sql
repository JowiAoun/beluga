-- Real-time mode: reads add the newest events that aren't materialised yet.
-- `category` is the civic category on reports, else the hazard kind.
create materialized view if not exists cell_15m
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('15 minutes', time) as bucket,
  cell,
  coalesce(civic_category, hazard_kind) as category,
  source,
  count(*) as events,
  count(*) filter (where event_kind = 'near_miss') as near_misses,
  count(*) filter (where event_kind = 'civic_report') as civic_reports,
  max(severity) as worst_severity,
  min(closest_m) as closest_m
from hazard_events
group by bucket, cell, category, source
with no data;

select add_continuous_aggregate_policy('cell_15m',
  start_offset => interval '3 days',
  end_offset => interval '1 minute',
  schedule_interval => interval '1 minute',
  if_not_exists => true);
