"""seed_species

Revision ID: 6f001aedd7d4
Revises: f60f71918573
Create Date: 2026-05-30 10:14:50.464287

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from sqlalchemy.sql import table, column
from sqlalchemy import String, Float
from sqlalchemy.dialects.postgresql import UUID, ARRAY

# revision identifiers, used by Alembic.
revision: str = '6f001aedd7d4'
down_revision: Union[str, None] = 'f60f71918573'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    INSERT INTO plant_species (
        id, common_name, scientific_name, genus, family, 
        co2_absorption_rate, pm25_absorption_rate, voc_absorption_rate, 
        toxicity_level, allergen_risk, maintenance_level, growth_rate, 
        space_type_compatibility, temperature_range, soil_ph_range
    ) VALUES 
    (gen_random_uuid(), 'Snake Plant', 'Sansevieria trifasciata', 'Sansevieria', 'Asparagaceae', 12.5, 8.0, 15.0, 'LOW', 'NONE', 'LOW', 'SLOW', ARRAY['INDOOR', 'OUTDOOR_BALCONY']::spacetype[], '10-35C', '6.0-7.5'),
    (gen_random_uuid(), 'Spider Plant', 'Chlorophytum comosum', 'Chlorophytum', 'Asparagaceae', 10.0, 15.0, 25.0, 'NONE', 'NONE', 'LOW', 'FAST', ARRAY['INDOOR']::spacetype[], '15-25C', '6.0-7.0'),
    (gen_random_uuid(), 'Peace Lily', 'Spathiphyllum wallisii', 'Spathiphyllum', 'Araceae', 15.0, 12.0, 20.0, 'MEDIUM', 'LOW', 'MEDIUM', 'MODERATE', ARRAY['INDOOR']::spacetype[], '18-27C', '5.8-6.5'),
    (gen_random_uuid(), 'English Ivy', 'Hedera helix', 'Hedera', 'Araliaceae', 8.0, 25.0, 18.0, 'HIGH', 'MEDIUM', 'LOW', 'FAST', ARRAY['INDOOR', 'OUTDOOR_GARDEN']::spacetype[], '10-21C', '6.0-7.5'),
    (gen_random_uuid(), 'Aloe Vera', 'Aloe barbadensis', 'Aloe', 'Asphodelaceae', 14.0, 5.0, 10.0, 'MEDIUM', 'NONE', 'LOW', 'SLOW', ARRAY['INDOOR', 'OUTDOOR_BALCONY']::spacetype[], '15-30C', '7.0-8.5'),
    (gen_random_uuid(), 'Rubber Plant', 'Ficus elastica', 'Ficus', 'Moraceae', 18.0, 10.0, 12.0, 'MEDIUM', 'LOW', 'MEDIUM', 'MODERATE', ARRAY['INDOOR']::spacetype[], '16-24C', '6.0-7.0'),
    (gen_random_uuid(), 'Golden Pothos', 'Epipremnum aureum', 'Epipremnum', 'Araceae', 11.0, 14.0, 22.0, 'MEDIUM', 'NONE', 'LOW', 'FAST', ARRAY['INDOOR']::spacetype[], '18-29C', '6.0-6.5'),
    (gen_random_uuid(), 'Boston Fern', 'Nephrolepis exaltata', 'Nephrolepis', 'Nephrolepidaceae', 5.0, 18.0, 20.0, 'NONE', 'NONE', 'HIGH', 'MODERATE', ARRAY['INDOOR', 'OUTDOOR_BALCONY']::spacetype[], '15-24C', '5.5-6.5'),
    (gen_random_uuid(), 'Bamboo Palm', 'Chamaedorea seifrizii', 'Chamaedorea', 'Arecaceae', 20.0, 12.0, 18.0, 'NONE', 'NONE', 'MEDIUM', 'SLOW', ARRAY['INDOOR']::spacetype[], '18-27C', '6.0-7.0'),
    (gen_random_uuid(), 'Chinese Evergreen', 'Aglaonema commutatum', 'Aglaonema', 'Araceae', 12.0, 9.0, 15.0, 'MEDIUM', 'NONE', 'LOW', 'SLOW', ARRAY['INDOOR']::spacetype[], '16-27C', '5.5-6.5'),
    (gen_random_uuid(), 'Dracaena', 'Dracaena marginata', 'Dracaena', 'Asparagaceae', 16.0, 11.0, 19.0, 'MEDIUM', 'NONE', 'LOW', 'SLOW', ARRAY['INDOOR']::spacetype[], '18-26C', '6.0-7.0'),
    (gen_random_uuid(), 'ZZ Plant', 'Zamioculcas zamiifolia', 'Zamioculcas', 'Araceae', 10.0, 6.0, 8.0, 'MEDIUM', 'NONE', 'LOW', 'SLOW', ARRAY['INDOOR']::spacetype[], '18-30C', '6.0-7.0'),
    (gen_random_uuid(), 'Philodendron', 'Philodendron hederaceum', 'Philodendron', 'Araceae', 14.0, 13.0, 21.0, 'MEDIUM', 'NONE', 'LOW', 'FAST', ARRAY['INDOOR']::spacetype[], '18-27C', '5.5-7.0'),
    (gen_random_uuid(), 'Areca Palm', 'Dypsis lutescens', 'Dypsis', 'Arecaceae', 25.0, 16.0, 14.0, 'NONE', 'NONE', 'HIGH', 'MODERATE', ARRAY['INDOOR', 'OUTDOOR_BALCONY']::spacetype[], '16-24C', '6.0-6.5'),
    (gen_random_uuid(), 'Weeping Fig', 'Ficus benjamina', 'Ficus', 'Moraceae', 19.0, 12.0, 17.0, 'MEDIUM', 'MEDIUM', 'MEDIUM', 'MODERATE', ARRAY['INDOOR', 'OUTDOOR_GARDEN']::spacetype[], '18-24C', '6.0-7.0'),
    (gen_random_uuid(), 'Cast Iron Plant', 'Aspidistra elatior', 'Aspidistra', 'Asparagaceae', 7.0, 5.0, 6.0, 'NONE', 'NONE', 'LOW', 'SLOW', ARRAY['INDOOR', 'OUTDOOR_GARDEN']::spacetype[], '10-29C', '5.5-7.5'),
    (gen_random_uuid(), 'Devil''s Ivy', 'Epipremnum pinnatum', 'Epipremnum', 'Araceae', 12.0, 15.0, 23.0, 'MEDIUM', 'NONE', 'LOW', 'FAST', ARRAY['INDOOR', 'OUTDOOR_BALCONY']::spacetype[], '15-30C', '6.0-6.5'),
    (gen_random_uuid(), 'Parlor Palm', 'Chamaedorea elegans', 'Chamaedorea', 'Arecaceae', 15.0, 10.0, 12.0, 'NONE', 'NONE', 'LOW', 'SLOW', ARRAY['INDOOR']::spacetype[], '18-27C', '6.0-7.0'),
    (gen_random_uuid(), 'Bird''s Nest Fern', 'Asplenium nidus', 'Asplenium', 'Aspleniaceae', 8.0, 14.0, 16.0, 'NONE', 'NONE', 'MEDIUM', 'MODERATE', ARRAY['INDOOR']::spacetype[], '15-24C', '5.0-6.0'),
    (gen_random_uuid(), 'Moth Orchid', 'Phalaenopsis', 'Phalaenopsis', 'Orchidaceae', 11.0, 4.0, 7.0, 'NONE', 'LOW', 'HIGH', 'SLOW', ARRAY['INDOOR']::spacetype[], '16-27C', '5.5-6.5');
    """)


def downgrade() -> None:
    op.execute("DELETE FROM plant_species")
