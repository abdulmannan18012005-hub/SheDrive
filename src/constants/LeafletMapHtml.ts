export const LEAFLET_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>SheDrive Leaflet Map Engine</title>
  <!-- Leaflet CSS CDN -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #f8f9fa;
    }
    .custom-marker {
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 26px;
      transition: transform 0.3s ease-out;
      filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3));
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 4px 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <!-- Leaflet JS CDN -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var map;
    var markers = {};
    var currentRoute = null;

    function sendToReactNative(type, data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data }));
      }
    }

    function initMap(lat, lng, zoom) {
      if (map) return;

      map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        zoomAnimation: true
      }).setView([lat, lng], zoom);

      // CartoDB Voyager Tiles (Clean, high contrast, English place names)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);

      map.on('click', function(e) {
        sendToReactNative('MAP_CLICKED', { lat: e.latlng.lat, lng: e.latlng.lng });
      });

      map.on('moveend', function() {
        var center = map.getCenter();
        sendToReactNative('MAP_DRAGGED', { lat: center.lat, lng: center.lng });
      });

      sendToReactNative('MAP_READY', {});
    }

    function autoFitAllBounds() {
      if (!map) return;
      var bounds = L.latLngBounds([]);

      // Include all markers
      Object.keys(markers).forEach(function(key) {
        if (markers[key]) {
          bounds.extend(markers[key].getLatLng());
        }
      });

      // Include route polyline
      if (currentRoute) {
        bounds.extend(currentRoute.getBounds());
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
      }
    }

    window.addEventListener('message', function(event) {
      try {
        var message = JSON.parse(event.data);
        var type = message.type;
        var data = message.data;

        switch (type) {
          case 'INIT_MAP':
            initMap(data.lat, data.lng, data.zoom || 14);
            break;

          case 'SET_CENTER':
            if (map) {
              map.setView([data.lat, data.lng], data.zoom || map.getZoom(), { animate: true });
            }
            break;

          case 'ADD_MARKER':
            if (!map) return;

            if (markers[data.id]) {
              // Smooth position transition if marker already exists
              markers[data.id].setLatLng([data.lat, data.lng]);
              if (data.title) markers[data.id].bindPopup(data.title);
            } else {
              var markerIcon = L.divIcon({
                className: 'custom-marker',
                html: data.emoji || '📍',
                iconSize: [34, 34],
                iconAnchor: [17, 17]
              });

              var marker = L.marker([data.lat, data.lng], { icon: markerIcon }).addTo(map);
              if (data.title) marker.bindPopup(data.title);
              markers[data.id] = marker;
            }
            break;

          case 'REMOVE_MARKER':
            if (map && markers[data.id]) {
              map.removeLayer(markers[data.id]);
              delete markers[data.id];
            }
            break;

          case 'DRAW_ROUTE':
            if (!map) return;
            if (currentRoute) {
              map.removeLayer(currentRoute);
            }

            var path = data.coordinates.map(function(coord) {
              return [coord[0], coord[1]];
            });

            currentRoute = L.polyline(path, {
              color: '#D81B60', // Vibrant SheDrive Pink Accent
              weight: 5,
              opacity: 0.85,
              lineJoin: 'round',
              lineCap: 'round'
            }).addTo(map);

            autoFitAllBounds();
            break;

          case 'CLEAR_ROUTE':
            if (map && currentRoute) {
              map.removeLayer(currentRoute);
              currentRoute = null;
            }
            break;
        }
      } catch (e) {
        sendToReactNative('ERROR', { message: e.message });
      }
    });

    setTimeout(function() {
      if (!map) {
        initMap(31.5204, 74.3587, 14);
      }
    }, 1200);
  </script>
</body>
</html>
`;
