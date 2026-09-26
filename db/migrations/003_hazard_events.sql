-- Every event from the phones, and the simulated week. No image, no session id, no raw device key.
create table if not exists hazard_events (
  time timestamptz not null,
  -- Civic reports only: HMAC-SHA256 of the device key with DEVICE_HASH_SALT, first 16 hex characters.
  device_hash text,
  event_kind text not null check (event_kind in ('hazard_seen', 'near_miss', 'civic_report')),
  hazard_kind text not null check (hazard_kind in ('obstacle', 'head_height', 'drop_off')),
  detector_class text not null,
  civic_category text,
  severity smallint check (severity between 1 and 4),
  confidence real,
  description text,
  closest_m real not null,
  angle_deg real,
  heading_deg real,
  -- Rounded to 3 decimals, about 100 m, on the phone and again at intake.
  lat double precision not null,
  lon double precision not null,
  cell text not null,
  station_id text references stations (station_id),
  context text,
  source text not null default 'live' check (source in ('live', 'simulated')),
  consent_version smallint not null,
  location geography(point, 4326) generated always as (st_point(lon, lat, 4326)::geography) stored
);

select create_hypertable('hazard_events', by_range('time', interval '1 day'), if_not_exists => true);
