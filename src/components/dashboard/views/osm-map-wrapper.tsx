"use client"

import dynamic from "next/dynamic"

const OSMMapView = dynamic(() => import("./osm-map-view").then((m) => ({ default: m.OSMMapView })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[600px] rounded-xl border bg-muted/20">
      <div className="text-center">
        <div className="h-8 w-8 mx-auto mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Chargement de la carte OpenStreetMap…</p>
      </div>
    </div>
  ),
})

export function OSMMapViewWrapper() {
  return <OSMMapView />
}
