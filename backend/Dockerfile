FROM python:3.12-slim

# System deps for dlib, opencv, face_recognition
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download DeepFace model weights so cold starts don't fetch them
RUN python -c "from deepface import DeepFace; DeepFace.build_model('Facenet512')"

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
