import requests
import json

query = """
[out:json][timeout:90];
area["name"="Paris"]["admin_level"="8"]->.searchArea;
(
  way["amenity"="pharmacy"](area.searchArea);
  way["amenity"="hospital"](area.searchArea);
  way["amenity"="clinic"](area.searchArea);
  way["amenity"="police"](area.searchArea);
  way["shop"="supermarket"](area.searchArea);
);
out geom;
"""

print("Fetching data from Overpass API for all of Paris (this might take 10-20 seconds)...")
try:
    response = requests.post("https://overpass-api.de/api/interpreter", data={"data": query})
    response.raise_for_status()
    data = response.json()

    features = []
    for el in data.get('elements', []):
        if 'geometry' not in el: continue
        
        tags = el.get('tags', {})
        amenity = tags.get('amenity')
        shop = tags.get('shop')
        
        color = '#7f8c8d'
        height = 15
        if amenity == 'pharmacy':
            color = '#2ecc71'; height = 20
        elif amenity in ['hospital', 'clinic']:
            color = '#e74c3c'; height = 40
        elif amenity == 'police':
            color = '#3498db'; height = 30
        elif shop == 'supermarket':
            color = '#e67e22'; height = 25
            
        coords = [[g['lon'], g['lat']] for g in el['geometry']]
        # Ensure polygon is closed
        if len(coords) >= 3 and coords[0] != coords[-1]:
            coords.append(coords[0])
            
        # A valid polygon needs at least 4 points (including the closed one)
        if len(coords) >= 4:
            features.append({
                "type": "Feature",
                "properties": {"color": color, "height": height},
                "geometry": {"type": "Polygon", "coordinates": [coords]}
            })

    geojson = {"type": "FeatureCollection", "features": features}
    with open("pois.geojson", "w", encoding="utf-8") as f:
        json.dump(geojson, f)
    print(f"Success! Saved {len(features)} points of interest to pois.geojson")
except Exception as e:
    print(f"Error: {e}")
