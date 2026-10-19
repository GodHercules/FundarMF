# Operação Segura

## Antes de produção

1. Configurar segredos aleatórios em secret manager; nunca usar `.env.example` como segredo.
2. Definir `FRONTEND_URL`, allowlist e `TRUST_PROXY` somente para proxies conhecidos.
3. Aplicar migrações em janela controlada e validar índices por tenant.
4. Configurar TLS, WAF/rate limit distribuído, logs redigidos e alertas.
5. Executar smoke tests de login, OTP, upload, tenant e logout.
6. Fazer backup e ensaio de restauração antes de aceitar dados.

## Incidentes

Preservar correlation ID e logs redigidos, revogar sessões/segredos afetados, congelar webhooks suspeitos, avaliar escopo por tenant e registrar linha do tempo. Não incluir tokens, OTPs ou conteúdo de documentos em tickets.

O pacote `backend/worker` não está disponível como workspace verificável; qualquer operação de fila deve ser tratada como não validada até restauração do pacote.
