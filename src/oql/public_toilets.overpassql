[out:json][timeout:25];
// gather results for public toilets
(
  // query part for: "amenity=toilets"
  node["amenity"="toilets"]([bbox]);
  relation["amenity"="toilets"]([bbox]);
);
// print results
out body;
>;
out skel qt;

