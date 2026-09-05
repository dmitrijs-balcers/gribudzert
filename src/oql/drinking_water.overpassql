[out:json][timeout:25];
// gather nodes, ways and relations for all types of drinking water sources
(
  nwr["natural"="spring"]([bbox]);
  nwr["man_made"="water_well"]([bbox]);
  nwr["man_made"="water_tap"]([bbox]);
  nwr["amenity"="drinking_water"]([bbox]);
  nwr["waterway"="water_point"]([bbox]);
);
// print tags plus a centre point for ways/relations; no member recursion
out center;
