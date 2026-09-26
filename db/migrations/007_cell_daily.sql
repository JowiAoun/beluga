-- Stacked on cell_15m. Refresh cell_15m first when refreshing by hand.
create materialized view if not exists cell_daily
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('1 day', bucket) as day,
  cell,
  category,
  source,
  sum(events)::bigint as events,
  sum(near_misses)::bigint as near_misses,
  sum(civic_reports)::bigint as civic_reports,
  max(worst_severity) as worst_severity,
  min(closest_m) as closest_m,
  -- The newest 15-minute bucket with a report, for the fix-first recency.
  max(bucket) filter (where civic_reports > 0) as last_report
from cell_15m
group by day, cell, category, source
with no data;

select add_continuous_aggregate_policy('cell_daily',
  start_offset => interval '30 days',
  end_offset => interval '1 hour',
  schedule_interval => interval '15 minutes',
  if_not_exists => true);
