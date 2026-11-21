"""
Location and Geospatial Utilities.
Provides reverse geocoding fallback and distance calculations.
"""

import math
from typing import Optional, Tuple


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


location_service = LocationService()
