import enum

class ToxicityLevel(str, enum.Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class AllergenRisk(str, enum.Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class MaintenanceLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class GrowthRate(str, enum.Enum):
    SLOW = "slow"
    MODERATE = "moderate"
    FAST = "fast"

class SpaceType(str, enum.Enum):
    INDOOR = "indoor"
    OUTDOOR_BALCONY = "outdoor_balcony"
    OUTDOOR_GARDEN = "outdoor_garden"
    PUBLIC_PARK = "public_park"

class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    MANUAL_REVIEW = "manual_review"

class UrbanRuralClass(str, enum.Enum):
    URBAN = "urban"
    SUBURBAN = "suburban"
    RURAL = "rural"

class PollutionSeverityClass(str, enum.Enum):
    GOOD = "good"
    MODERATE = "moderate"
    UNHEALTHY_SENSITIVE = "unhealthy_sensitive"
    UNHEALTHY = "unhealthy"
    VERY_UNHEALTHY = "very_unhealthy"
    HAZARDOUS = "hazardous"

class NewsCategory(str, enum.Enum):
    ENVIRONMENT = "environment"
    COMMUNITY = "community"
    TIPS = "tips"
    ALERTS = "alerts"
