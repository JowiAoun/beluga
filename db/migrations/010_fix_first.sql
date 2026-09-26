-- The fix-first queue: spots with civic reports in the last 14 days, ranked by the score in
-- docs/PLAN.md ("fix_first view"). The numbers match FIX_FIRST and SEVERITY_WEIGHTS in
-- lib/shared/params.ts. `sources` picks live, simulated or both, for the dashboard's filter.
-- Only spots with 3 or more reporters show (k-anonymity), and severity 4 goes to "Check now".
create or replace function fix_first_for(sources text[])
returns table (
  cell text,
  category text,
  worst_severity smallint,
  reporters bigint,
  near_misses bigint,
  last_report timestamptz,
  station_id text,
  station_name text,
  place text,
  severity_weight double precision,
  reporter_part double precision,
  near_miss_part double precision,
  recency double precision,
  transit double precision,
  score double precision,
  includes_simulated boolean
)
language sql stable as $$
  with reports as (
    select d.cell, d.category,
           max(d.worst_severity) as worst_severity,
           max(d.last_report) as last_report,
           bool_or(d.source = 'simulated') as includes_simulated
    from cell_daily d
    where d.day >= now() - interval '14 days'
      and d.civic_reports > 0
      and d.source = any(sources)
      and d.category not in ('obstacle', 'head_height', 'drop_off')
    group by d.cell, d.category
  ),
  reporters as (
    select r.cell, r.civic_category as category, count(distinct r.device_hash) as reporters
    from cell_reporters_daily r
    where r.day >= now() - interval '14 days' and r.source = any(sources)
    group by r.cell, r.civic_category
  ),
  pressure as (
    select d.cell, sum(d.near_misses)::bigint as near_misses
    from cell_daily d
    where d.day >= now() - interval '14 days' and d.source = any(sources)
    group by d.cell
  ),
  nearest as (
    select distinct on (c.cell) c.cell, s.station_id, s.name,
           st_distance(s.location, st_pointfromgeohash(c.cell)::geography) as metres
    from (select distinct cell from reports) c
    cross join stations s
    order by c.cell, metres
  ),
  parts as (
    select rep.cell, rep.category, rep.worst_severity,
           coalesce(who.reporters, 0) as reporters,
           coalesce(p.near_misses, 0) as near_misses,
           rep.last_report,
           rep.includes_simulated,
           n.station_id, n.name as station_name, n.metres,
           power(2, rep.worst_severity - 1)::double precision as severity_weight,
           (ln(1 + coalesce(who.reporters, 0)) / ln(2))::double precision as reporter_part,
           (1 + log(1 + coalesce(p.near_misses, 0)))::double precision as near_miss_part,
           case
             when rep.last_report >= now() - interval '48 hours' then 1.5
             else power(0.5, extract(epoch from now() - rep.last_report) / 86400 / 7)
           end::double precision as recency,
           case when n.metres <= 150 then 1.3 else 1 end::double precision as transit
    from reports rep
    left join reporters who on who.cell = rep.cell and who.category = rep.category
    left join pressure p on p.cell = rep.cell
    left join nearest n on n.cell = rep.cell
  )
  select cell, category, worst_severity, reporters, near_misses, last_report,
         case when metres <= 150 then station_id end,
         case when metres <= 150 then station_name end,
         case when metres <= 150 then 'near ' || station_name else cell end,
         severity_weight, reporter_part, near_miss_part, recency, transit,
         severity_weight * reporter_part * near_miss_part * recency * transit,
         includes_simulated
  from parts
  where reporters >= 3 and worst_severity < 4
  order by 15 desc;
$$;

create or replace view fix_first as
select * from fix_first_for(array['live', 'simulated']);
