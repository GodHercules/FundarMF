# Plano de Rollback

## Aplicação

- Reverter a versão da aplicação para o artefato anterior somente se o schema permanecer compatível.
- Não remover índices novos sem confirmar que os índices antigos não recriam colisões entre tenants.
- Se a migração de unicidade já tiver sido aplicada, restaurar somente com plano de manutenção e backup validado.

## Dados e segredos

- Em caso de exposição, revogar sessões e rotacionar os segredos no provedor, sem gravá-los no Git.
- Restaurar banco apenas de backup cuja restauração tenha sido ensaiada.
- Após rollback, repetir autenticação, autorização, tenant isolation, uploads e auditoria.

Nenhum rollback remoto foi executado nesta auditoria.
