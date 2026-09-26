const fs = require('fs');

const tags = [
  'node["amenity"="pharmacy"]', 'way["amenity"="pharmacy"]',
  'node["amenity"="hospital"]', 'way["amenity"="hospital"]',
  'node["amenity"="clinic"]', 'way["amenity"="clinic"]',
  'node["amenity"="police"]', 'way["amenity"="police"]',
  'node["shop"="supermarket"]', 'way["shop"="supermarket"]'
];

async function fetchAll() {
  let allFeatures = [];
  console.log("Fetching POIs for Île-de-France...");

  for (let i = 0; i < tags.length; i += 2) {
    const nodeTag = tags[i];
    const wayTag = tags[i+1];
    
    // Bounding box pour l'Île-de-France : approx 48.12, 1.44, 49.24, 3.56
    const bbox = "48.12,1.44,49.24,3.56";
    const query = `
      [out:json][timeout:180];
      (
        ${nodeTag}(${bbox});
        ${wayTag}(${bbox});
      );
      out geom;
    `;
    
    console.log(`Fetching ${nodeTag.split('=')[1]}...`);
    
    let success = false;
    let attempts = 0;
    while (!success && attempts < 5) {
      try {
        const response = await fetch("https://overpass.openstreetmap.fr/api/interpreter", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "User-Agent": "HackathonApp",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "data=" + encodeURIComponent(query)
        });
        
        if (response.status === 429) {
          console.log("Rate limit hit (429), waiting 15 seconds...");
          await new Promise(r => setTimeout(r, 15000));
          attempts++;
          continue;
        }
        
        if (!response.ok) {
          console.error(`HTTP Error: ${response.status}`);
          break;
        }
        
        const data = await response.json();
        let count = 0;
        
        if (data.elements) {
            for (const el of data.elements) {
                const elTags = el.tags || {};
                const amenity = elTags.amenity;
                const shop = elTags.shop;
                
                let color = '#7f8c8d';
                let height = 6;
                
                if (amenity === 'pharmacy') { color = '#2ecc71'; height = 7; }
                else if (amenity === 'hospital' || amenity === 'clinic') { color = '#e74c3c'; height = 12; }
                else if (amenity === 'police') { color = '#3498db'; height = 8; }
                else if (shop === 'supermarket') { color = '#e67e22'; height = 6; }
                else { continue; } 
                
                let coords = [];
                
                // On calcule le centre
                let cLon = 0, cLat = 0;
                if (el.type === 'node') {
                    cLon = el.lon;
                    cLat = el.lat;
                } else if (el.type === 'way' && el.geometry) {
                    el.geometry.forEach(g => { cLon += g.lon; cLat += g.lat; });
                    cLon /= el.geometry.length;
                    cLat /= el.geometry.length;
                }
                
                // On crée un énorme carré (environ 25 mètres x 25 mètres) autour de ce centre,
                // pour former un gros bloc visible, uniforme et carré
                if (cLon !== 0 && cLat !== 0) {
                    const sLon = 0.00015; // Taille Lattitude/Longitude approximative
                    const sLat = 0.00010;
                    coords = [
                        [cLon - sLon, cLat - sLat], [cLon + sLon, cLat - sLat],
                        [cLon + sLon, cLat + sLat], [cLon - sLon, cLat + sLat],
                        [cLon - sLon, cLat - sLat]
                    ];
                }
  
                if (coords.length >= 4) {
                    allFeatures.push({
                        type: "Feature",
                        properties: { color, height },
                        geometry: { type: "Polygon", coordinates: [coords] }
                    });
                    count++;
                }
            }
        }
        console.log(`-> Added ${count} items.`);
        success = true;
        
        // Pause to respect API rate limits before the next query
        await new Promise(r => setTimeout(r, 5000));
        
      } catch (e) {
        console.error("Fetch error:", e);
        await new Promise(r => setTimeout(r, 10000));
        attempts++;
      }
    }
  }
  
  const geojson = { type: "FeatureCollection", features: allFeatures };
  const jsContent = "const poisData = " + JSON.stringify(geojson) + ";"; // Removed formatting spaces to reduce file size
  fs.writeFileSync("pois.js", jsContent, "utf-8");
  console.log(`\nSuccess! Saved a total of ${allFeatures.length} points of interest to pois.js`);
}

fetchAll();
