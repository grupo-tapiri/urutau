#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[ERRO] Execute este script como root (sudo bash vps-hardening-ssh-ufw.sh)." >&2
  exit 1
fi

SSH_PORT="${SSH_PORT:-22}"
ADMIN_SSH_USER="${ADMIN_SSH_USER:-}"

echo "=== [1/6] Auditando chaves SSH publicas antes de desativar login por senha ==="
HAS_AUTH_KEYS=0
if [ -s /root/.ssh/authorized_keys ]; then
  HAS_AUTH_KEYS=1
fi
if [ -n "${ADMIN_SSH_USER}" ] && [ -s "/home/${ADMIN_SSH_USER}/.ssh/authorized_keys" ]; then
  HAS_AUTH_KEYS=1
fi
for kh in /home/*/.ssh/authorized_keys; do
  if [ -f "${kh}" ] && [ -s "${kh}" ]; then
    HAS_AUTH_KEYS=1
  fi
done

if [ "${HAS_AUTH_KEYS}" -ne 1 ]; then
  echo "[BLOQUEADO] Nenhuma chave publica encontrada em authorized_keys. Cadastre sua chave SSH Ed25519 antes de bloquear senhas para evitar lockout." >&2
  exit 2
fi

echo "=== [2/6] Auditoria e remocao/bloqueio de usuarios padrao de imagem (ex.: alpine) ==="
SUSPICIOUS_DEFAULT_USERS=("alpine" "ubuntu-default" "guest" "test")
for usr in "${SUSPICIOUS_DEFAULT_USERS[@]}"; do
  if id "${usr}" >/dev/null 2>&1; then
    echo "[AUDITORIA] Bloqueando e removendo conta padrao detectada: ${usr}"
    passwd -l "${usr}" || true
    usermod -s /usr/sbin/nologin "${usr}" || true
    userdel -r "${usr}" 2>/dev/null || true
  fi
done

echo "=== [3/6] Atualizando pacotes criticos (OpenSSH / OpenSSL / libc) ==="
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install --only-upgrade -y openssh-server openssl ufw fail2ban || apt-get install -y openssh-server ufw fail2ban
elif command -v apk >/dev/null 2>&1; then
  apk update
  apk upgrade openssh openssl
fi

echo "=== [4/6] Aplicando blindagem estrita no sshd_config (Somente Chave Publica) ==="
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-urutau-zero-trust.conf <<EOF
Port ${SSH_PORT}
Protocol 2
PasswordAuthentication no
PermitEmptyPasswords no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
LoginGraceTime 25
X11Forwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

sshd -t

echo "=== [5/6] Reiniciando imediatamente o daemon SSH na memoria (Mitigacao CVE pos-update) ==="
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart sshd 2>/dev/null || systemctl restart ssh
elif command -v rc-service >/dev/null 2>&1; then
  rc-service sshd restart
else
  service ssh restart
fi

echo "=== [6/6] Isolamento de portas com UFW (Somente 80, 443 e SSH; servicos internos em 127.0.0.1) ==="
if command -v ufw >/dev/null 2>&1; then
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw limit "${SSH_PORT}/tcp"
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw deny 3000/tcp
  ufw deny 5432/tcp
  ufw deny 6379/tcp
  ufw --force enable
  ufw status verbose
fi

echo "=== Auditoria pos-deploy concluida ==="
echo "Contas com shell interativo ativas:"
awk -F: '($7 !~ /nologin|false|sync|shutdown|halt/) {print " - " $1 " (" $7 ")"}' /etc/passwd
