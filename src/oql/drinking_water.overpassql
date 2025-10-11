[out:json][timeout:25];
// Drinking water points in current map view
(
  node["amenity"="drinking_water"]([bbox]);
);
out center tags;
