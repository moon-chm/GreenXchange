# GreenXchange

GreenXchange is a decentralized, full-stack platform that incentivizes community-driven urban greening through AI-powered plant recommendations, computer-vision growth tracking, and an append-only cryptographic reward ledger.

## Features
- **AI Plant Recommendations**: Get plant recommendations based on local climate and environmental factors.
- **Computer Vision Verification**: Upload plant growth images which are verified using an automated computer vision pipeline (ELA, anomaly detection).
- **Reward Ledger**: A robust, append-only ledger that rewards users with GXC tokens for verified plant growth.
- **Community Drives**: Discover and join localized tree planting drives using PostGIS spatial queries.
- **Unified Dashboard**: Blazing fast, fault-tolerant unified dashboard gathering environment, plants, rewards, drives, and news.

## Architecture & Security Setup
- **Frontend**: Next.js (React), Tailwind CSS
- **Backend**: FastAPI (Python), SQLAlchemy AsyncORM
- **Database**: PostgreSQL with PostGIS (over SSL)
- **Object Storage**: MinIO (AES-256 Server-Side Encryption)
- **Task Queue**: Celery with Redis
- **Reverse Proxy**: Nginx with TLS Configuration
- **Logging**: Structured JSON logging (`python-json-logger`)

## Local Development Setup

### 1. Environment Configuration
Copy the `.env.example` file to create your local `.env` configuration.
```bash
cp .env.example .env
```
Ensure you update passwords and add your `OPENAI_API_KEY`.

### 2. Generate Local TLS & Database SSL Certificates
For local development, Nginx and Postgres require self-signed certificates. Run the following command from the project root:
```bash
mkdir -p certs
docker run --rm -v ${PWD}/certs:/certs alpine/openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /certs/server.key -out /certs/server.crt -subj "/C=US/ST=State/L=City/O=GreenXchange/CN=localhost"
```

Then format the certificate permissions for PostgreSQL:
```bash
docker run --rm -v greenxchange_postgres_data:/var/lib/postgresql/data -v ${PWD}/certs:/certs alpine sh -c "cp /certs/server.* /var/lib/postgresql/data/ && chown 999:999 /var/lib/postgresql/data/server.* && chmod 600 /var/lib/postgresql/data/server.key"
```

### 3. Model File Integration
The backend Computer Vision worker requires the verification model to run.
1. Download or train the `plant_cv_v1.pkl` model file.
2. Place it in `backend/assets/models/plant_cv_v1.pkl`.

### 4. Start the Application
Run the standard Docker Compose command:
```bash
docker compose up -d --build
```
Access the application at `https://localhost` (you will need to bypass the local self-signed certificate warning in your browser).

## Production Deployment

For production, use the production compose profile which enforces resource limits, restart policies, and JSON logging drivers:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**Note on Production TLS:**
In production, you should replace the self-signed certificates in `nginx/default.conf` with valid Let's Encrypt certificates using Certbot.

## Database Migrations
We use Alembic for database migrations. To run migrations inside the backend container:
```bash
docker compose exec backend alembic upgrade head
```
