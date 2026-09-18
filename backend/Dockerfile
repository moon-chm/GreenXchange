# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/

# Install CPU-only PyTorch first (avoids pulling CUDA build — saves ~1.7 GB)
RUN pip install --no-cache-dir \
    torch==2.2.2+cpu \
    torchvision==0.17.2+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining application dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code — this includes backend/models/**/*.pth (committed to
# git; see .gitignore), so the AI model weights are baked into the image with
# no network fetch at build time.
COPY . /app/

# Fail the build loudly if the committed model weights are ever missing,
# rather than silently falling back to heuristics at runtime.
RUN test -f /app/models/model1/tree_detector_resnet18.pth && \
    test -f "/app/models/model 2/new-plant_health_resnet18_balanced.pth" && \
    echo "AI model weights present: $(du -sh /app/models/model1/*.pth "/app/models/model 2/"*.pth | cut -f1 | tr '\n' ' ')"

CMD ["sh", "-c", "alembic upgrade head || true; uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
