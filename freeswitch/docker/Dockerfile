FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Dependências base
RUN apt-get update && apt-get install -y \
    gnupg2 wget curl lsb-release ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Repo oficial FreeSWITCH
RUN wget -O - https://files.freeswitch.org/repo/deb/debian-release/fscomm-filelist.pub.asc | gpg --dearmor > /usr/share/keyrings/freeswitch.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/freeswitch.gpg] https://files.freeswitch.org/repo/deb/debian-release/ bookworm main" > /etc/apt/sources.list.d/freeswitch.list

# Instalar FreeSWITCH com módulos necessários
RUN apt-get update && apt-get install -y \
    freeswitch \
    freeswitch-mod-commands \
    freeswitch-mod-console \
    freeswitch-mod-dialplan-xml \
    freeswitch-mod-dptools \
    freeswitch-mod-event-socket \
    freeswitch-mod-sofia \
    freeswitch-mod-verto \
    freeswitch-mod-rtc \
    freeswitch-mod-tone-stream \
    freeswitch-mod-say-pt \
    freeswitch-mod-sndfile \
    freeswitch-mod-native-file \
    freeswitch-mod-shout \
    freeswitch-mod-local-stream \
    freeswitch-mod-lua \
    freeswitch-mod-curl \
    freeswitch-mod-httapi \
    freeswitch-mod-http-cache \
    freeswitch-mod-xml-curl \
    freeswitch-mod-cdr-csv \
    freeswitch-mod-json-cdr \
    freeswitch-mod-callcenter \
    freeswitch-mod-fifo \
    freeswitch-mod-voicemail \
    freeswitch-mod-conference \
    freeswitch-mod-db \
    freeswitch-mod-hash \
    freeswitch-mod-opus \
    freeswitch-sounds-en-us-callie \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 para ESL controller e AI pipeline
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Diretórios de trabalho
RUN mkdir -p /opt/walk-voip/esl-controller \
    /opt/walk-voip/ai-pipeline \
    /var/lib/freeswitch/recordings \
    /var/log/freeswitch

# Copiar configs
COPY config/ /etc/freeswitch/

# Copiar aplicação Node.js
COPY ../scripts/ /opt/walk-voip/

WORKDIR /opt/walk-voip

# Instalar dependências Node
RUN cd esl-controller && npm install && \
    cd ../ai-pipeline && npm install

# Portas
# 5060: SIP UDP/TCP
# 5061: SIP TLS
# 8021: Event Socket
# 8082: Verto WebSocket (WebRTC)
# 16384-32768: RTP media
EXPOSE 5060/udp 5060/tcp 5061/tcp 8021/tcp 8082/tcp 16384-32768/udp

# Script de inicialização
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
