# syntax=docker/dockerfile:1
FROM python:3.12-slim

# System deps for dlib, opencv, face_recognition
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# pip cache mount avoids re-downloading packages on rebuilds.
# Cloud Build persists BuildKit cache between jobs.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Pre-download DeepFace model weights BEFORE copying app code.
# This layer is only invalidated when requirements change, not on every code push.
RUN --mount=type=cache,target=/root/.deepface/weights \
    python -c "from deepface import DeepFace; DeepFace.build_model('Facenet512')"

COPY . .

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
