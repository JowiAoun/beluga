-- The five O-Train stations in lib/shared/stations.ts. Positions are approximate.
create table if not exists stations (
  station_id text primary key,
  name text not null,
  location geography(point, 4326) not null
);

insert into stations (station_id, name, location) values
  ('uottawa', 'uOttawa', st_point(-75.6828, 45.4205, 4326)::geography),
  ('rideau', 'Rideau', st_point(-75.6920, 45.4265, 4326)::geography),
  ('parliament', 'Parliament', st_point(-75.6990, 45.4215, 4326)::geography),
  ('lyon', 'Lyon', st_point(-75.7040, 45.4190, 4326)::geography),
  ('hurdman', 'Hurdman', st_point(-75.6645, 45.4125, 4326)::geography)
on conflict (station_id) do nothing;
