[out:json][timeout:25];
// gather nodes, ways and relations for public toilets
(
  nwr["amenity"="toilets"]([bbox]);
);
// print tags plus a centre point for ways/relations; no member recursion
out center;
