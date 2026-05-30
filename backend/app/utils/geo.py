import math
from typing import Tuple, Optional
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import io

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def _get_if_exist(data, key):
    if key in data:
        return data[key]
    return None

def _convert_to_degrees(value):
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except:
        return 0.0

def extract_exif_gps(image_bytes: bytes) -> Optional[Tuple[float, float]]:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        exif = image._getexif()
        if not exif:
            return None

        geotagging = {}
        for (idx, tag) in TAGS.items():
            if tag == 'GPSInfo':
                if idx not in exif:
                    return None
                for (key, val) in GPSTAGS.items():
                    if key in exif[idx]:
                        geotagging[val] = exif[idx][key]

        if not geotagging:
            return None

        gps_lat = _get_if_exist(geotagging, 'GPSLatitude')
        gps_lat_ref = _get_if_exist(geotagging, 'GPSLatitudeRef')
        gps_lon = _get_if_exist(geotagging, 'GPSLongitude')
        gps_lon_ref = _get_if_exist(geotagging, 'GPSLongitudeRef')

        if gps_lat and gps_lat_ref and gps_lon and gps_lon_ref:
            lat = _convert_to_degrees(gps_lat)
            if gps_lat_ref != "N":
                lat = -lat

            lon = _convert_to_degrees(gps_lon)
            if gps_lon_ref != "E":
                lon = -lon

            return lat, lon
    except Exception as e:
        print("EXIF parsing error:", e)
    
    return None

def get_tile_id(lat: float, lng: float) -> str:
    # Round to 2 decimal places (approx 1.1km grid)
    return f"{round(lat, 2)}_{round(lng, 2)}"

