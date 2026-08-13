# Ongea Pesa LiveKit voice worker.
#
# This container has NO inbound ports. The worker dials OUT to LiveKit Cloud and
# joins rooms as a participant, so it needs no reverse proxy, no TLS cert and no
# Traefik labels — unlike every other app on this VPS.

FROM python:3.12-slim

# libgomp1 is required by onnxruntime, which backs Silero VAD and the
# multilingual turn detector. Without it the import succeeds and the *load*
# fails at runtime, which is a confusing way to find out.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Never run as root.
RUN useradd --create-home --uid 10001 ongea
WORKDIR /app

COPY --chown=ongea:ongea requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=ongea:ongea agent.py .

USER ongea

# Bake the Silero VAD + turn-detector weights into the image. Doing this at
# build time rather than on boot means a container restart is instant and does
# not depend on the model host being reachable.
RUN python agent.py download-files

# Unbuffered so `docker logs` shows output as it happens, not in 4KB chunks.
ENV PYTHONUNBUFFERED=1

CMD ["python", "agent.py", "start"]
