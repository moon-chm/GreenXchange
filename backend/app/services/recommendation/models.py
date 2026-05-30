from abc import ABC, abstractmethod
from app.models.plants import PlantSpecies
from typing import Dict, Any

class ScoringModel(ABC):
    @abstractmethod
    def score(self, species: PlantSpecies, env_profile: Dict[str, Any], filters: Dict[str, Any]) -> float:
        pass
