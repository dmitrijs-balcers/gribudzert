[out:json][timeout:25];
// gather results for all types of drinking water sources
(
  // query part for: "natural=spring"
  node["natural"="spring"]([bbox]);
  relation["natural"="spring"]([bbox]);
  // query part for: "man_made=water_well"
  node["man_made"="water_well"]([bbox]);
  relation["man_made"="water_well"]([bbox]);
  // query part for: "man_made=water_tap"
  node["man_made"="water_tap"]([bbox]);
  relation["man_made"="water_tap"]([bbox]);
  // query part for: "amenity=drinking_water"
  node["amenity"="drinking_water"]([bbox]);
  relation["amenity"="drinking_water"]([bbox]);
  // query part for: "waterway=water_point"
  node["waterway"="water_point"]([bbox]);
  relation["waterway"="water_point"]([bbox]);
);
// print results
out body;
>;
out skel qt;
