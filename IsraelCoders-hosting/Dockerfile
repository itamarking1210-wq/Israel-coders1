FROM python:3.12-slim
WORKDIR /app
COPY . .
# הנתונים (משתמשים, התקדמות, חיבורים) נשמרים ב-/data — חברו לשם דיסק קבוע
ENV HOST=0.0.0.0 PORT=8123 DATA_DIR=/data TRUST_PROXY=1 PYTHONUNBUFFERED=1
EXPOSE 8123
CMD ["python", "server.py"]
