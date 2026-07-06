# Auth Service Dockerfile
# --- Stage 1: Build & install dependencies ---
FROM python:3.10-slim AS builder
WORKDIR /app

# Create a virtual environment to isolate dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Stage 2: Runtime Environment ---
FROM python:3.10-slim
WORKDIR /app

# Copy the isolated virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv
COPY app/ ./app/

ENV PATH="/opt/venv/bin:$PATH"
EXPOSE 8000

# Create a non-root user and change file ownership for security
RUN useradd -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
