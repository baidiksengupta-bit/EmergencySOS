"""
Location and Geospatial Utilities.
Provides reverse geocoding fallback, distance calculations, and nearby emergency services queries.
"""

import math
import logging
from typing import Optional, Tuple, List, Dict, Any
import httpx

logger = logging.getLogger("emergency_sos.location")


class LocationService:
    @staticmethod
    def calculate_haversine_distance(
        coord1: Tuple[float, float], coord2: Tuple[float, float]
    ) -> float:
        """
        Calculate the great-circle distance between two points
        on the Earth (in kilometers).
        """
        lat1, lon1 = coord1
        lat2, lon2 = coord2

        r = 6371.0  # Earth radius in kilometers

        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    @staticmethod
    async def reverse_geocode_coordinates(latitude: float, longitude: float) -> Optional[str]:
        """
        Hook for Google Maps Geocoding API.
        Returns a formatted address string or coordinates string placeholder.
        """
        return f"{latitude:.5f}, {longitude:.5f}"

    @classmethod
    async def fetch_nearby_services_from_osm(
        cls,
        latitude: float,
        longitude: float,
        radius_m: int = 3000,
        timeout_seconds: float = 8.0,
    ) -> List[Dict[str, Any]]:
        """
        Queries OpenStreetMap Overpass API for nearby amenity='police' and amenity='hospital'
        nodes/ways around (latitude, longitude) within radius_m meters.
        Returns list of parsed facilities sorted nearest first.
        """
        overpass_query = f"""
        [out:json][timeout:10];
        (
          node["amenity"="police"](around:{radius_m},{latitude},{longitude});
          way["amenity"="police"](around:{radius_m},{latitude},{longitude});
          node["amenity"="hospital"](around:{radius_m},{latitude},{longitude});
          way["amenity"="hospital"](around:{radius_m},{latitude},{longitude});
        );
        out center;
        """

        overpass_url = "https://overpass-api.de/api/interpreter"
        headers = {
            "User-Agent": "EmergencySOS/1.0 (Emergency Response App; contact: help@emergencysos.org)"
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                overpass_url,
                data={"data": overpass_query},
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        elements = data.get("elements", [])
        results: List[Dict[str, Any]] = []

        for elem in elements:
            # Nodes have lat/lon directly; Ways with 'out center' have center: {lat, lon}
            lat = elem.get("lat") or (elem.get("center", {}).get("lat") if "center" in elem else None)
            lon = elem.get("lon") or (elem.get("center", {}).get("lon") if "center" in elem else None)
            if lat is None or lon is None:
                continue

            tags = elem.get("tags", {})
            amenity = tags.get("amenity")
            category = "police" if amenity == "police" else "hospital"

            name = tags.get("name")
            if not name:
                name = "Local Police Station" if category == "police" else "Emergency Hospital / Clinic"

            # Parse address components if available
            addr_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:city") or tags.get("addr:suburb"),
            ]
            address = ", ".join([p for p in addr_parts if p]) or tags.get("addr:full") or None

            distance_km = round(cls.calculate_haversine_distance((latitude, longitude), (lat, lon)), 2)

            results.append({
                "id": f"osm-{elem.get('type', 'node')}-{elem.get('id')}",
                "name": name,
                "category": category,
                "latitude": float(lat),
                "longitude": float(lon),
                "distance_km": distance_km,
                "address": address,
            })

        # Sort nearest first
        results.sort(key=lambda x: x["distance_km"])
        return results


location_service = LocationService()
