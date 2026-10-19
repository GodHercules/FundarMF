# Checklist de Segurança

| Controle | Resultado |
| --- | --- |
| 01 Autenticação e sessão | Implementado; testes unitários existentes. |
| 02 Autorização por papel | Implementado em rotas principais; faltam testes HTTP abrangentes. |
| 03 Isolamento multi-tenant | Corrigido nos caminhos auditados; modelo ainda incompleto. |
| 04 CSRF/origem | CORS e origem mutável com allowlist; validar em produção. |
| 05 Cookies e tokens | HttpOnly/Secure/SameSite; token de URL removido após leitura. |
| 06 OTP | Hash, expiração, tentativas e reenvio limitados. |
| 07 Input validation | DTOs, editor e uploads validados. |
| 08 Uploads | MIME, assinatura e tamanho; pressão concorrente pendente. |
| 09 XSS/CSP | Editor endurecido e CSP adicionada; nonce/hash é evolução futura. |
| 10 SQL/ORM | Prisma parametriza consultas; filtros tenant revisados. |
| 11 CORS | Allowlist unificada no backend. |
| 12 Headers | CSP, no-store, no-referrer, frame denial e nosniff. |
| 13 Secrets | Exemplo sem segredo operacional; arquivos locais ignorados não foram tocados. |
| 14 Dependências | Multer direto atualizado; auditoria transiente pendente. |
| 15 Logs/observabilidade | Redaction existente; webhook e retenção precisam revisão. |
| 16 Rate limiting | Implementado localmente; distribuído pendente. |
| 17 Banco/RLS | Não implementado/verificado. |
| 18 Backup/restore | Não implementado/verificado. |
| 19 CI/SCA/secrets scan | Não configurado neste snapshot. |
| 20 E2E/integração | Testes unitários passam; fluxos reais pendentes. |
