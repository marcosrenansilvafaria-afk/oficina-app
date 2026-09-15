# ADR-013 - Estrategia de seguranca e roteamento (API Gateway + Bearer JWT + RBAC)

Data: 15/09/2026
Status: Aceita

## Contexto
Com a autenticacao de clientes migrada para uma Lambda separada (ver
RFC-003), a aplicacao principal precisa continuar protegendo suas rotas
sensiveis (criacao/gestao de OS) por role, agora aceitando tokens emitidos
por duas origens: o login interno de funcionarios (`AuthService` do
NestJS) e a Lambda de autenticacao por CPF (Repositorio 2).

## Decisao
- API Gateway HTTP API (Repositorio 2) expondo unicamente a rota publica
  `POST /auth` - sem autenticacao nessa rota, ja que e o proprio ponto de
  entrada para obter um token.
- Todas as rotas de mutacao de Ordem de Servico no NestJS (`POST /os`,
  `/os/:id/diagnostico`, `/os/:id/executar`, etc.) continuam protegidas por
  `JwtAuthGuard` + `RolesGuard` + `@Roles(...)`, sem nenhuma mudanca de
  codigo em relacao a Fase 2.
- `Role.CLIENTE` adicionado ao enum de roles existente (`ADMIN`,
  `MECANICO`, `ATENDENTE`), e aplicado especificamente na rota
  `GET /os/:id/status` (consulta do proprio status da OS pelo cliente) -
  rota que antes estava totalmente aberta, sem nenhuma autenticacao.
- `JwtStrategy` **nao precisou de nenhuma mudanca de codigo**: ja validava
  o payload `{ sub, role }` contra `JWT_SECRET`, formato identico ao
  emitido pela Lambda. A unica exigencia operacional e manter o mesmo
  `JWT_SECRET` sincronizado manualmente entre os Repositorios 2 e 4 (via
  GitHub Secrets).
- Nenhuma comunicacao direta entre Repositorio 2 e Repositorio 4 em
  runtime - a confianca entre os dois servicos e inteiramente baseada na
  posse do mesmo segredo simetrico (HS256).

## Consequencias
- Positivas: reaproveitamento total da infraestrutura de autenticacao/
  autorizacao ja existente; superficie de ataque da rota publica limitada a
  um unico endpoint (`/auth`), com validacao de CPF antes de qualquer
  acesso a dados.
- Negativas: `JWT_SECRET` compartilhado por copia manual entre dois
  repositorios e dois times/pipelines diferentes e um ponto de falha
  operacional - se um dos dois for rotacionado sem o outro, todos os
  tokens da Lambda passam a ser rejeitados pelo NestJS sem erro claro no
  lado da Lambda (ela emite o token normalmente, o erro so aparece na
  validacao do outro lado).
- Risco aceito e documentado: sem assinatura assimetrica (RS256) neste
  momento - HS256 com segredo compartilhado foi escolhido por simplicidade
  operacional dentro do escopo da Fase 3; migrar para RS256 (chave privada
  so na Lambda, chave publica no NestJS) removeria a necessidade de
  compartilhar segredo, e fica registrado aqui como melhoria futura.

Relacionado ao PR #fase3-adr-013
