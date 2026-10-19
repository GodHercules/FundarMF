# Dependências e Supply Chain

O scan de produção registrado no início da auditoria reportou 1 crítica, 54 altas, 50 moderadas e 5 baixas em 442 dependências; esse inventário depende do registry e deve ser reexecutado antes do release.

## Ações

- `multer` direto foi atualizado para a linha 2.x e o lockfile foi regenerado.
- Next.js permanece na linha 14 e requer plano de upgrade compatível com a aplicação.
- Dependências transitivas de Express, parsers DOCX/PDF e roteamento continuam pendentes de triagem individual.
- Não há CI, Dependabot, SCA ou secret scanning configurado no snapshot.

Não foram copiados valores de vulnerabilidades, tokens ou arquivos de ambiente para esta documentação.
