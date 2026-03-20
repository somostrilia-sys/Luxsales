#!/bin/bash
#
# Walk Agente Central Hub - Setup VPS para FreeSWITCH
#
# Uso: curl -sSL https://raw.githubusercontent.com/somostrilia-sys/agente-central-hub/main/freeswitch/setup-vps.sh | bash
#
# Requisitos: Ubuntu 22.04+ ou Debian 12, root access
#

set -euo pipefail

echo "=============================================="
echo "  Walk Agente Central Hub - VPS Setup"
echo "  FreeSWITCH + AI Pipeline"
echo "=============================================="

# Verificar root
if [ "$EUID" -ne 0 ]; then
    echo "Execute como root: sudo bash setup-vps.sh"
    exit 1
fi

# Variáveis (editar antes de rodar)
PUBLIC_IP="${PUBLIC_IP:-$(curl -s ifconfig.me)}"
DOMAIN="${DOMAIN:-vps.holdingwalk.com.br}"
ESL_PASSWORD="${ESL_PASSWORD:-$(openssl rand -base64 24)}"

echo ""
echo "IP Público: $PUBLIC_IP"
echo "Domínio: $DOMAIN"
echo ""

# ============================================================
# 1. Dependências base
# ============================================================
echo "[1/7] Instalando dependências..."
apt-get update
apt-get install -y \
    gnupg2 wget curl git ca-certificates \
    ufw fail2ban \
    docker.io docker-compose

systemctl enable docker
systemctl start docker

# ============================================================
# 2. Firewall
# ============================================================
echo "[2/7] Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp          # SSH
ufw allow 5060/udp        # SIP
ufw allow 5060/tcp        # SIP TCP
ufw allow 5061/tcp        # SIP TLS
ufw allow 8082/tcp        # Verto (WebRTC)
ufw allow 16384:32768/udp # RTP media
# NÃO abrir 8021 (ESL) e 3000/3001 (APIs internas) - apenas localhost
ufw --force enable

# ============================================================
# 3. Fail2ban para SIP
# ============================================================
echo "[3/7] Configurando fail2ban para SIP..."
cat > /etc/fail2ban/jail.d/freeswitch.conf << 'FAIL2BAN'
[freeswitch]
enabled  = true
port     = 5060
protocol = udp
filter   = freeswitch
logpath  = /var/log/freeswitch/freeswitch.log
maxretry = 5
bantime  = 3600
findtime = 600
FAIL2BAN

cat > /etc/fail2ban/filter.d/freeswitch.conf << 'FILTER'
[Definition]
failregex = \[WARNING\] sofia_reg.c.*Can't find user.*<HOST>
            \[WARNING\] sofia_reg.c.*SIP auth failure.*<HOST>
ignoreregex =
FILTER

systemctl restart fail2ban

# ============================================================
# 4. Clonar repositório
# ============================================================
echo "[4/7] Clonando repositório..."
mkdir -p /opt/walk-voip
cd /opt/walk-voip

if [ -d ".git" ]; then
    git pull
else
    git clone https://github.com/somostrilia-sys/agente-central-hub.git .
fi

# ============================================================
# 5. Configurar .env
# ============================================================
echo "[5/7] Configurando variáveis de ambiente..."
if [ ! -f /opt/walk-voip/freeswitch/docker/.env ]; then
    cat > /opt/walk-voip/freeswitch/docker/.env << ENV
# Walk Agente Central Hub - FreeSWITCH Config
# Gerado em $(date)

# Servidor
PUBLIC_IP=$PUBLIC_IP
DOMAIN=$DOMAIN
ESL_PASSWORD=$ESL_PASSWORD

# Supabase
SUPABASE_URL=https://ecaduzwautlpzpvjognr.supabase.co
SUPABASE_SERVICE_KEY=PREENCHER_COM_SERVICE_KEY

# SIP Trunk (preencher com dados da operadora)
SIP_TRUNK_HOST=PREENCHER
SIP_TRUNK_USER=PREENCHER
SIP_TRUNK_PASS=PREENCHER
SIP_TRUNK_PORT=5060

# IA
ANTHROPIC_API_KEY=PREENCHER
DEEPGRAM_API_KEY=PREENCHER
CARTESIA_API_KEY=PREENCHER
ENV

    echo ""
    echo "⚠️  IMPORTANTE: Edite /opt/walk-voip/freeswitch/docker/.env"
    echo "    Preencha as chaves de API e dados do SIP Trunk"
    echo ""
fi

# ============================================================
# 6. SSL (Let's Encrypt) para WebRTC
# ============================================================
echo "[6/7] Configurando SSL para WebRTC..."
apt-get install -y certbot

if [ "$DOMAIN" != "vps.holdingwalk.com.br" ] || host "$DOMAIN" > /dev/null 2>&1; then
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email alex@trilia.com.br || true

    mkdir -p /opt/walk-voip/freeswitch/docker/ssl
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/walk-voip/freeswitch/docker/ssl/
        cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /opt/walk-voip/freeswitch/docker/ssl/
        cat /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/letsencrypt/live/$DOMAIN/privkey.pem > /opt/walk-voip/freeswitch/docker/ssl/agent.pem

        # Auto-renewal
        echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem /opt/walk-voip/freeswitch/docker/ssl/ && docker restart walk-freeswitch" | crontab -
    fi
else
    echo "⚠️  DNS não configurado para $DOMAIN - SSL será configurado depois"
fi

# ============================================================
# 7. Iniciar (mas não sobe até .env estar preenchido)
# ============================================================
echo "[7/7] Setup concluído!"
echo ""
echo "=============================================="
echo "  Setup concluído!"
echo "=============================================="
echo ""
echo "Próximos passos:"
echo ""
echo "1. Edite o .env:"
echo "   nano /opt/walk-voip/freeswitch/docker/.env"
echo ""
echo "2. Configure DNS:"
echo "   $DOMAIN → $PUBLIC_IP (A record)"
echo ""
echo "3. Inicie o FreeSWITCH:"
echo "   cd /opt/walk-voip/freeswitch/docker"
echo "   docker-compose up -d"
echo ""
echo "4. Verifique o status:"
echo "   docker logs -f walk-freeswitch"
echo "   docker exec walk-freeswitch fs_cli -x 'sofia status'"
echo ""
echo "5. No Supabase, configure os secrets:"
echo "   FREESWITCH_ESL_API_URL=http://$PUBLIC_IP:3000"
echo ""
echo "Portas abertas: 5060/UDP (SIP), 5061/TCP (SIP-TLS),"
echo "  8082/TCP (WebRTC), 16384-32768/UDP (RTP)"
echo ""
echo "ESL Password: $ESL_PASSWORD"
echo "(salve em local seguro!)"
echo ""
