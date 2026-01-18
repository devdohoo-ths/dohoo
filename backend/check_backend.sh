#!/bin/bash

SERVICE_NAME="dohoo-backend"
LOG_FILE="/root/.pm2/logs/dohoo-backend-error.log"
TELEGRAM_TOKEN="8212449635:AAHpOAaIqPrYm2rKkOgxr7VxL6rRRr_1oHs"
CHAT_ID="1457558504"

DISK_THRESHOLD=90
RAM_THRESHOLD=85

send_message() {
    local TEXT="$1"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
        -d chat_id="$CHAT_ID" \
        -d text="$TEXT" >/dev/null
}

# 1. Verifica status do backend via pm2 jlist (com jq)
STATUS=$(pm2 jlist | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.status")

if [ "$STATUS" != "online" ]; then
    LAST_ERRORS=$(tail -n 15 "$LOG_FILE")
    MSG="⚠️ O serviço $SERVICE_NAME está $STATUS!

📄 Últimos erros:
$LAST_ERRORS"
    send_message "$MSG"
fi

# 2. Verifica RAM
read TOTAL USED <<< $(free -m | awk '/Mem:/ {print $2" "$3}')
RAM_USAGE=$((100 * USED / TOTAL))

if [ "$RAM_USAGE" -gt "$RAM_THRESHOLD" ]; then
    TOP_PROC=$(ps -eo pid,comm,%mem,%cpu --sort=-%mem | head -n 2)
    MSG="🧠 Alerta: RAM em ${RAM_USAGE}% (${USED}MB de ${TOTAL}MB)

📌 Processo que mais consome memória:
$TOP_PROC"
    send_message "$MSG"
fi

# 3. Verifica Disco (partição raiz /)
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$DISK_USAGE" -gt "$DISK_THRESHOLD" ]; then
    send_message "💾 Alerta: Disco / em ${DISK_USAGE}% de uso"
fi
