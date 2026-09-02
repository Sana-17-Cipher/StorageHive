FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY namenode.py .
CMD ["uvicorn", "namenode:app", "--host", "0.0.0.0", "--port", "8000"]

#NameNode will run an HTTP server on port 8000.

