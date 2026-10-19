# Matriz de Risco

| Risco | Probabilidade | Impacto | Estado | Próxima ação |
| --- | --- | --- | --- | --- |
| Acesso cross-tenant em modelo filho | Média | Crítico | Mitigação parcial | Adicionar tenant a entidades filhas, FKs compostas e testes HTTP. |
| Dependência vulnerável transitiva | Alta | Alto | Pendente | Atualizar lockfile por árvore e revisar advisories. |
| DoS por upload/OCR | Média | Alto | Mitigação parcial | Limites por usuário/tenant, fila isolada e teste de concorrência. |
| Token/OTP em provedor externo | Média | Alto | Pendente operacional | Redaction, retenção mínima e revisão do webhook. |
| Rate limit por instância | Média | Médio | Pendente | Redis/WAF e teste distribuído. |
| Proxy confiável incorretamente | Condicional | Alto | Pendente | Permitir apenas hops configurados; rejeitar `true` em produção. |
| Backup não restaurável | Desconhecida | Crítico | Não verificado | Configurar backup, retenção, PITR e ensaio de restauração. |
| XSS no editor | Baixa após correção | Alto | Corrigido | Manter testes de schema e URLs seguras. |
