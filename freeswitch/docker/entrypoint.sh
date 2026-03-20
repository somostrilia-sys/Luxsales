#!/bin/bash
set -e

echo "=== Walk Agente Central Hub - FreeSWITCH Server ==="
echo "Starting at $(date)"

# Substituir variáveis nos configs do FreeSWITCH
if [ -n "$PUBLIC_IP" ]; then
    sed -i "s/\${PUBLIC_IP}/$PUBLIC_IP/g" /etc/freeswitch/vars.xml
fi
if [ -n "$DOMAIN" ]; then
    sed -i "s/\${DOMAIN}/$DOMAIN/g" /etc/freeswitch/vars.xml
fi
if [ -n "$ESL_PASSWORD" ]; then
    sed -i "s/\${ESL_PASSWORD}/$ESL_PASSWORD/g" /etc/freeswitch/autoload_configs/event_socket.conf.xml
fi

# Configurar SIP Trunk dinamicamente
if [ -n "$SIP_TRUNK_HOST" ]; then
    sed -i "s/\${SIP_TRUNK_HOST}/$SIP_TRUNK_HOST/g" /etc/freeswitch/sip_profiles/external/*.xml
    sed -i "s/\${SIP_TRUNK_USER}/$SIP_TRUNK_USER/g" /etc/freeswitch/sip_profiles/external/*.xml
    sed -i "s/\${SIP_TRUNK_PASS}/$SIP_TRUNK_PASS/g" /etc/freeswitch/sip_profiles/external/*.xml
    sed -i "s/\${SIP_TRUNK_PORT}/$SIP_TRUNK_PORT/g" /etc/freeswitch/sip_profiles/external/*.xml
fi

# Iniciar FreeSWITCH em background
echo "Starting FreeSWITCH..."
/usr/bin/freeswitch -nonat -nf &
FS_PID=$!

# Aguardar FreeSWITCH estar pronto
echo "Waiting for FreeSWITCH to be ready..."
for i in $(seq 1 30); do
    if fs_cli -x "status" > /dev/null 2>&1; then
        echo "FreeSWITCH is ready!"
        break
    fi
    sleep 1
done

# Iniciar ESL Controller (Node.js)
echo "Starting ESL Controller..."
cd /opt/walk-voip/esl-controller
node index.js &
ESL_PID=$!

# Iniciar AI Pipeline (Node.js)
echo "Starting AI Pipeline..."
cd /opt/walk-voip/ai-pipeline
node index.js &
AI_PID=$!

echo "=== All services started ==="
echo "FreeSWITCH PID: $FS_PID"
echo "ESL Controller PID: $ESL_PID"
echo "AI Pipeline PID: $AI_PID"

# Trap para shutdown graceful
trap "kill $AI_PID $ESL_PID; fs_cli -x 'shutdown'; wait" SIGTERM SIGINT

# Manter container rodando
wait $FS_PID
