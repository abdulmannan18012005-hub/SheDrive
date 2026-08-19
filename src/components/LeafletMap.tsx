import React, { forwardRef } from 'react';
import { GoogleMapView, GoogleMapViewProps, GoogleMapViewRef, MapMarker } from './GoogleMapView';

export type { MapMarker, GoogleMapViewRef as LeafletMapRef };

export const LeafletMap = forwardRef<GoogleMapViewRef, GoogleMapViewProps>((props, ref) => {
  return <GoogleMapView ref={ref} {...props} />;
});

LeafletMap.displayName = 'LeafletMap';
export default LeafletMap;
