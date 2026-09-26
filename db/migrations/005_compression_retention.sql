-- Chunks older than 7 days turn columnar, grouped by cell. Raw events go after 180 days; the
-- aggregates keep their counts.
alter table hazard_events set (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby = 'cell',
  timescaledb.orderby = 'time desc'
);

call add_columnstore_policy('hazard_events', after => interval '7 days', if_not_exists => true);

select add_retention_policy('hazard_events', drop_after => interval '180 days', if_not_exists => true);
