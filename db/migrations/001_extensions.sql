-- Tiger Cloud has TimescaleDB already; a local test database may not.
create extension if not exists timescaledb;
create extension if not exists postgis;
