-- Distinct reporters per spot, for the 3-reporter rule. Device hashes never leave the database.
create materialized view if not exists cell_reporters_daily
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('1 day', time) as day,
  cell,
  civic_category,
  device_hash,
  source,
  count(*) as reports
from hazard_events
where event_kind = 'civic_report' and device_hash is not null
group by day, cell, civic_category, device_hash, source
with no data;

select add_continuous_aggregate_policy('cell_reporters_daily',
  start_offset => interval '30 days',
  end_offset => interval '1 hour',
  schedule_interval => interval '5 minutes',
  if_not_exists => true);
