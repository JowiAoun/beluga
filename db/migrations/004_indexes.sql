create index if not exists hazard_events_cell_time on hazard_events (cell, time desc);
create index if not exists hazard_events_station_time on hazard_events (station_id, time desc);
create index if not exists hazard_events_category_time on hazard_events (civic_category, time desc);
create index if not exists hazard_events_kind_time on hazard_events (event_kind, time desc);
create index if not exists hazard_events_location on hazard_events using gist (location);
