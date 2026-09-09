'use client';

import { useEffect, useRef } from 'react';
import type { MapField } from './page';

// Leaflet CSS
import 'leaflet/dist/leaflet.css';

interface Props {
  fields: MapField[];
  selected: MapField | null;
  onSelect: (field: MapField) => void;
  getCropColor: (cropType: string) => string;
}

export default function MapView({ fields, selected, onSelect, getCropColor }: Props) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = require('leaflet');

    // Fix default icon issue with Next.js
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Azerbaijan center
    const map = L.map(containerRef.current, {
      center: [40.4093, 49.8671],
      zoom: 8,
      zoomControl: true,
    });

    // Satellite tiles (Esri)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
        maxZoom: 19,
      }
    ).addTo(map);

    // Label overlay
    L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { opacity: 0.7, maxZoom: 19 }
    ).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when fields change
  useEffect(() => {
    if (!mapRef.current) return;
    const L = require('leaflet');
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    const bounds: [number, number][] = [];

    fields.forEach(field => {
      if (!field.latitude || !field.longitude) return;

      const lat = field.latitude;
      const lng = field.longitude;
      bounds.push([lat, lng]);

      const crop    = field.seasonFields[0];
      const color   = crop ? getCropColor(crop.cropType) : '#9CA3AF';
      const isSelected = selected?.id === field.id;

      // Custom circular marker
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width: ${isSelected ? 44 : 36}px;
            height: ${isSelected ? 44 : 36}px;
            background: ${color};
            border: ${isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.8)'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            cursor: pointer;
            transition: all 0.2s;
            font-size: ${isSelected ? '11px' : '9px'};
            font-weight: 700;
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            font-family: system-ui;
            text-align: center;
            line-height: 1;
          ">
            ${field.fieldNumber.length > 4 ? field.fieldNumber.slice(0, 4) : field.fieldNumber}
          </div>
        `,
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
      });

      const marker = L.marker([lat, lng], { icon });

      marker.bindTooltip(`
        <div style="font-family: system-ui; font-size: 12px; padding: 2px 4px;">
          <strong>Sahə #${field.fieldNumber}</strong><br/>
          ${field.farm.name}<br/>
          ${field.hectares} ha${crop ? `<br/>${crop.cropType}` : ''}
        </div>
      `, { permanent: false, direction: 'top', offset: [0, -10] });

      marker.on('click', () => onSelect(field));
      marker.addTo(map);
      markersRef.current.set(field.id, marker);
    });

    // Fit bounds if we have markers
    if (bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      } catch (_) {}
    }
  }, [fields, selected, getCropColor, onSelect]);

  // Pan to selected field
  useEffect(() => {
    if (!mapRef.current || !selected?.latitude) return;
    mapRef.current.flyTo([selected.latitude, selected.longitude], 13, { duration: 0.8 });
  }, [selected]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: 400 }}
    />
  );
}
