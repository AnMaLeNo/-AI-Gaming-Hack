const fs = require('fs');

const bbox = "48.83, 2.30, 48.88, 2.40"; 

// On cherche maintenant les noeuds (points) ET les ways (polygones/bâtiments)
const query = `
[out:json][timeout:60];
(
  node["amenity"="pharmacy"](${bbox});
  way["amenity"="pharmacy"](${bbox});
  node["amenity"="hospital"](${bbox});
  way["amenity"="hospital"](${bbox});
  node["amenity"="clinic"](${bbox});
  way["amenity"="clinic"](${bbox});
  node["amenity"="police"](${bbox});
  way["amenity"="police"](${bbox});
  node["shop"="supermarket"](${bbox});
  way["shop"="supermarket"](${bbox});
);
out geom;
`;

console.log("Fetching nodes and ways via French OSM endpoint...");

fetch("https://overpass.openstreetmap.fr/api/interpreter", {
    method: "POST",
    headers: {
        "Accept": "application/json",
        "User-Agent": "HackathonApp",
        "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "data=" + encodeURIComponent(query)
})
.then(r => r.json())
.then(data => {
    const features = [];
    if (data.elements) {
        for (const el of data.elements) {
            const tags = el.tags || {};
            const amenity = tags.amenity;
            const shop = tags.shop;
            
            let color = '#7f8c8d';
            let height = 6;
            
            // Les bâtiments standards sont à 5. On met les POI légèrement plus haut (ou à la même hauteur) pour le réalisme.
            if (amenity === 'pharmacy') { color = '#2ecc71'; height = 7; }
            else if (amenity === 'hospital' || amenity === 'clinic') { color = '#e74c3c'; height = 12; }
            else if (amenity === 'police') { color = '#3498db'; height = 8; }
            else if (shop === 'supermarket') { color = '#e67e22'; height = 6; }
            
            let coords = [];
            
            if (el.type === 'node') {
                // C'est un simple point (très fréquent sur OpenStreetMap)
                // On crée un petit carré autour du point pour pouvoir l'extruder en 3D
                // (s est beaucoup plus petit pour correspondre à la taille d'une vraie boutique)
                const s = 0.00004; 
                coords = [
                    [el.lon - s, el.lat - s],
                    [el.lon + s, el.lat - s],
                    [el.lon + s, el.lat + s],
                    [el.lon - s, el.lat + s],
                    [el.lon - s, el.lat - s] // fermer le polygone
                ];
            } else if (el.type === 'way' && el.geometry) {
                coords = el.geometry.map(g => [g.lon, g.lat]);
                if (coords.length >= 3 && (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1])) {
                    coords.push(coords[0]);
                }
                
                // Si c'est un hôpital, on vérifie si la zone n'est pas gigantesque (domaine complet de la Pitié-Salpêtrière par ex)
                if (amenity === 'hospital' && coords.length > 3) {
                    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
                    coords.forEach(c => {
                        if(c[0] < minLon) minLon = c[0];
                        if(c[0] > maxLon) maxLon = c[0];
                        if(c[1] < minLat) minLat = c[1];
                        if(c[1] > maxLat) maxLat = c[1];
                    });
                    const widthLon = maxLon - minLon;
                    const heightLat = maxLat - minLat;
                    
                    // Si l'emprise dépasse environ 80-100 mètres (0.001 degrés en lat/lon), on réduit au point central
                    if (widthLon > 0.001 || heightLat > 0.001) {
                        const centerLon = (minLon + maxLon) / 2;
                        const centerLat = (minLat + maxLat) / 2;
                        const s = 0.0001; // On fait un carré moyen (plus grand qu'une pharmacie, mais pas géant)
                        coords = [
                            [centerLon - s, centerLat - s],
                            [centerLon + s, centerLat - s],
                            [centerLon + s, centerLat + s],
                            [centerLon - s, centerLat + s],
                            [centerLon - s, centerLat - s]
                        ];
                    }
                }
            }

            if (coords.length >= 4) {
                features.push({
                    type: "Feature",
                    properties: { color, height },
                    geometry: { type: "Polygon", coordinates: [coords] }
                });
            }
        }
    }
    const geojson = { type: "FeatureCollection", features };
    const jsContent = "const poisData = " + JSON.stringify(geojson, null, 2) + ";";
    fs.writeFileSync("pois.js", jsContent, "utf-8");
    console.log(`Success! Saved ${features.length} points of interest to pois.js`);
})
.catch(e => console.error("Error:", e));
