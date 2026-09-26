-- The performance panel's measured numbers (Phase 8).
create table if not exists perf_snapshots (
  taken_at timestamptz not null default now(),
  raw_ms real,
  aggregate_ms real,
  compressed_bytes bigint,
  uncompressed_bytes bigint,
  total_rows bigint,
  seed_load_seconds real,
  notes text
);
