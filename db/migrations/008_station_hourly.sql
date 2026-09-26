create materialized view if not exists station_hourly
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('1 hour', time) as bucket,
  station_id,
  hazard_kind,
  source,
  count(*) filter (where event_kind = 'near_miss') as near_misses,
  count(*) filter (where event_kind = 'civic_report') as civic_reports,
  count(*) as events
from hazard_events
where station_id is not null
group by bucket, station_id, hazard_kind, source
with no data;

select add_continuous_aggregate_policy('station_hourly',
  start_offset => interval '3 days',
  end_offset => interval '1 minute',
  schedule_interval => interval '1 minute',
  if_not_exists => true);
