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
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . /app/

# ─── Download AI model weights from GitHub Releases ───────────────────────────
# Models are stored as GitHub Release assets (not in git — too large for VCS)
# Set MODEL_RELEASE_URL build arg to override the release tag if needed
ARG GITHUB_REPO=moon-chm/GreenXchange
ARG MODEL_RELEASE_TAG=v1.0-models

RUN mkdir -p /app/models/model1 "/app/models/model 2"

RUN echo "Downloading Tree Detector model (Model 1)..." && \
    (curl -fL --retry 2 --connect-timeout 10 \
    "https://github.com/${GITHUB_REPO}/releases/download/${MODEL_RELEASE_TAG}/tree_detector_resnet18.pth" \
    -o /app/models/model1/tree_detector_resnet18.pth && \
    echo "Model 1 downloaded successfully: $(du -sh /app/models/model1/tree_detector_resnet18.pth | cut -f1)") || \
    echo "Notice: Model 1 release not found or offline. Backend will use fallback vegetation detection until release is published."

RUN echo "Downloading Plant Health model (Model 2)..." && \
    (curl -fL --retry 2 --connect-timeout 10 \
    "https://github.com/${GITHUB_REPO}/releases/download/${MODEL_RELEASE_TAG}/new-plant_health_resnet18_balanced.pth" \
    -o "/app/models/model 2/new-plant_health_resnet18_balanced.pth" && \
    echo "Model 2 downloaded successfully: $(du -sh "/app/models/model 2/new-plant_health_resnet18_balanced.pth" | cut -f1)") || \
    echo "Notice: Model 2 release not found or offline. Backend will use baseline health scoring until release is published."

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
