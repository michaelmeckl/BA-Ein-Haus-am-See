/*
  getAmenities(amenities, res) {
    const conString = "pg://localhost/portland_from_osm";
    const client = new pg.Client(conString);
    client.connect();

    const fc = {
      type: "FeatureCollection",
      features: [],
    };

    const sql =
      "SELECT name, ST_AsGeoJSON(ST_TRANSFORM(way, 4326)) AS way, tags->'cuisine' AS cuisine " +
      "FROM planet_osm_point " +
      "WHERE amenity = 'restaurant' AND name IS NOT NULL;";

    client.query(sql, function (err, result) {
      result.rows.forEach(function (feature) {
        const tags = feature.tags;

        const f = {
          type: "Feature",
          geometry: JSON.parse(feature.way),
          properties: {
            name: feature.name,
            cuisine: feature.cuisine,
          },
        };
        fc.features.push(f);
      });

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(fc);
    });
  }
  */
