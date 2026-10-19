# Correções Aplicadas

- Escopo por tenant em alterações contratuais, métricas, unicidade ativa e auditoria administrativa.
- Métricas protegidas por autenticação e papel.
- Validação de editor rico no backend e URLs seguras no frontend.
- CSP e headers de proteção no Next.js.
- Remoção imediata de token da URL, `no-store` e autocomplete seguro para login/OTP.
- CORS baseado em allowlist única.
- Compose local limitado a localhost.
- `multer` direto atualizado e lockfile regenerado.
- Robots e sitemap impedem indexação de rotas privadas.

## Limites

A migração de índices foi criada, mas não aplicada a banco remoto. Nenhuma implantação, rotação de segredo, alteração de produção ou push foi feita.
