# Auditoria de Segurança

## Resultado

Foram corrigidos problemas confirmados de isolamento, métricas, auditoria, editor rico, token na URL, CSP, CORS, headers, compose local e autocomplete. A auditoria não comprova segurança de produção.

## Achados

| ID | Severidade | Situação | Evidência / ação |
| --- | --- | --- | --- |
| SEC-001 | Alta | Corrigido parcialmente | Alterações contratuais e métricas agora recebem `tenantKey`; entidades filhas e RLS ainda exigem desenho futuro. |
| SEC-002 | Média | Corrigido | Índices de unicidade ativa foram escopados por tenant em nova migração. |
| SEC-003 | Média | Corrigido | Auditoria administrativa preserva o tenant do ator. |
| SEC-004 | Média | Corrigido | `/public/metrics` deixou de ser público e passou a exigir papel autorizado. |
| SEC-005 | Média | Corrigido | Editor valida marcas, heading e URLs; `javascript:`, `data:` e `vbscript:` são rejeitados. |
| SEC-006 | Média | Corrigido | Token da página de link é removido do histórico com `replaceState`; resposta usa `no-store`. |
| SEC-007 | Baixa | Corrigido | CSP, `Referrer-Policy`, `Permissions-Policy`, frame denial e MIME hardening adicionados. |
| SEC-008 | Alta | Parcial | `multer` direto atualizado; dependências transientes e upgrade maior do Next ainda pendentes. |
| SEC-009 | Média | Corrigido localmente | PostgreSQL/Mailpit no Compose estão ligados a localhost; não é configuração de produção. |
| SEC-010 | Média | Pendente | Rate limit continua em memória e `TRUST_PROXY` precisa de política por ambiente. |
| SEC-011 | Média | Pendente | Não há backup/restore, RLS, CI de segurança ou E2E completo verificável. |

Não foram lidos, alterados ou publicados arquivos de segredo local.
