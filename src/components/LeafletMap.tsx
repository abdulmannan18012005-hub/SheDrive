import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { LEAFLET_MAP_HTML } from '../constants/LeafletMapHtml';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  emoji?: string;
  title?: string;
}

export interface LeafletMapRef {
  setCenter: (lat: number, lng: number, zoom?: number) => void;
  drawRoute: (coordinates: [number, number][]) => void;
  clearRoute: () => void;
}

interface LeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  routeCoordinates?: [number, number][] | null;
  onMapReady?: () => void;
  onMapClicked?: (coords: { lat: number; lng: number }) => void;
  onMapDragged?: (coords: { lat: number; lng: number }) => void;
}

export const LeafletMap = forwardRef<LeafletMapRef, LeafletMapProps>(
  (
    {
      center,
      zoom = 14,
      markers = [],
      routeCoordinates = null,
      onMapReady,
      onMapClicked,
      onMapDragged,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const isMapInitialized = useRef(false);

    // Expose methods to parent components via ref
    useImperativeHandle(ref, () => ({
      setCenter: (lat: number, lng: number, targetZoom?: number) => {
        postMessageToMap('SET_CENTER', { lat, lng, zoom: targetZoom });
      },
      drawRoute: (coordinates: [number, number][]) => {
        postMessageToMap('DRAW_ROUTE', { coordinates });
      },
      clearRoute: () => {
        postMessageToMap('CLEAR_ROUTE', {});
      },
    }));

    // Post messages into WebView
    const postMessageToMap = (type: string, data: any) => {
      if (webViewRef.current) {
        const messageString = JSON.stringify({ type, data });
        webViewRef.current.postMessage(messageString);
      }
    };

    // Synchronize markers when they change
    useEffect(() => {
      if (isMapInitialized.current) {
        // Send add/update commands for each marker
        markers.forEach((marker) => {
          postMessageToMap('ADD_MARKER', marker);
        });
      }
    }, [markers]);

    // Synchronize route when it changes
    useEffect(() => {
      if (isMapInitialized.current) {
        if (routeCoordinates && routeCoordinates.length > 0) {
          postMessageToMap('DRAW_ROUTE', { coordinates: routeCoordinates });
        } else {
          postMessageToMap('CLEAR_ROUTE', {});
        }
      }
    }, [routeCoordinates]);

    // Initialize map location once WebView loads
    const handleLoadEnd = () => {
      postMessageToMap('INIT_MAP', { lat: center.lat, lng: center.lng, zoom });
    };

    // Parse messages originating from WebView
    const handleMessage = (event: any) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        const { type, data } = message;

        switch (type) {
          case 'MAP_READY':
            isMapInitialized.current = true;
            // Draw current markers and routes
            markers.forEach((marker) => {
              postMessageToMap('ADD_MARKER', marker);
            });
            if (routeCoordinates && routeCoordinates.length > 0) {
              postMessageToMap('DRAW_ROUTE', { coordinates: routeCoordinates });
            }
            if (onMapReady) onMapReady();
            break;

          case 'MAP_CLICKED':
            if (onMapClicked) onMapClicked(data);
            break;

          case 'MAP_DRAGGED':
            if (onMapDragged) onMapDragged(data);
            break;

          case 'ERROR':
            console.warn('Map Bridge error:', data.message);
            break;
        }
      } catch (e) {
        console.error('Error handling message from map:', e);
      }
    };

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: LEAFLET_MAP_HTML }}
          style={styles.mapWebView}
          onLoadEnd={handleLoadEnd}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          // Performance and platform compatibility configurations
          mixedContentMode="always"
          allowUniversalAccessFromFileURLs={true}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  mapWebView: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
});

LeafletMap.displayName = 'LeafletMap';
