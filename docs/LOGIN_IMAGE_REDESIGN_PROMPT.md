# Prompt aplicado: redesign da tela de login por referência visual

```text
## Goal
Refaça somente a experiência visual da tela de login do FundarMF em `frontend/app/page.tsx` e `frontend/app/globals.css`, usando a imagem de referência anexada como âncora de composição: uma tela split-screen, apresentação de marca em azul à esquerda e formulário claro à direita.

## Context
- Stack: Next.js 14, React, TypeScript, Tailwind e CSS global.
- A autenticação existente deve permanecer intacta: `POST /auth/login`, roteamento MASTER, consulta de destino do operador, loading e mensagem de erro.
- A marca deve usar a logo existente em `frontend/public/logo.png` e o nome FundarMF.
- A referência contém um foguete e textura de nuvem. Substitua ambos por uma linguagem de abertura de empresa: dossiê visual, CNPJ em preparação, documentos, validação e proteção de dados.
- Use componentes e padrões de referência apenas como inspiração de composição, densidade, tipografia e microinteração. Não copie código, assets, marcas ou estilos proprietários.

## Scope
- Pode editar `frontend/app/page.tsx`, `frontend/app/globals.css` e criar componentes visuais locais somente se necessário.
- Pode usar `react-icons`, já instalado, sem adicionar dependências.
- Mantenha o restante do produto e todos os fluxos de login inalterados.

## Design direction
- Desktop: split-screen ocupando `100svh`, painel azul amplo à esquerda e área de autenticação clara à direita.
- Painel esquerdo: logo FundarMF, título editorial sobre CNPJ, copy curta e uma composição visual de cartões/documentos com status “Em preparação”, sem foguete e sem ilustração genérica.
- Formulário: alinhado à esquerda dentro da coluna direita, com hierarquia clara, labels visíveis, inputs confortáveis, botão primário forte e estados de erro/loading preservados.
- Use azul institucional, branco, azul-claro e cinza de documento; evite neon, glassmorphism excessivo, gradientes chamativos e decoração sem função.
- Mobile: não esconda toda a proposta de valor; converta o painel azul em uma faixa superior responsiva, mantenha a composição visual compacta e deixe o formulário continuar abaixo com rolagem natural.
- Não force tudo ao centro da viewport. Aproveite largura e altura disponíveis, mantendo alinhamento editorial e margens consistentes.

## Accessibility and security
- Preserve `label`/`htmlFor`, `autocomplete`, foco visível, `role="alert"` e alvos de toque.
- Não renderize credenciais, tokens ou dados sensíveis na tela, logs ou mensagens de erro.
- Não altere a API de autenticação, armazenamento de sessão, CSP ou comportamento de roteamento sem evidência de necessidade.
- Respeite `prefers-reduced-motion`.

## Verification
- Execute lint, testes e build do frontend.
- Use Playwright CLI para abrir a rota `/`, capturar desktop em 1440px e mobile em 390px, verificar snapshot, navegação por teclado e ausência de overflow horizontal.
- Verifique visualmente que a logo e o nome FundarMF aparecem, que o dossiê visual não cobre o formulário e que o layout funciona em alturas pequenas.
- Faça uma revisão ECC de segurança focada na autenticação, entrada de credenciais, mensagens de erro, headers e exposição de dados.

## Done
Conclua apenas quando a tela estiver visualmente próxima da referência em composição, mas adaptada à identidade FundarMF e ao domínio tributário; todos os fluxos existentes continuarem funcionando; desktop e mobile forem responsivos; e os resultados de verificação forem reportados com evidências.
```

Target: Codex IDE, applied to the FundarMF repository.
