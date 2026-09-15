# RFC-003 - Estrategia de autenticacao serverless desacoplada via CPF e JWT

Data: 15/09/2026
Status: Aceita

## Resumo

Extrair a autenticacao de clientes (por CPF) da aplicacao principal para
uma AWS Lambda dedicada, atras de um API Gateway HTTP API, emitindo tokens
JWT que a aplicacao principal (Repositorio 4) valida sem nenhuma
comunicacao direta entre os dois servicos em runtime.

## Motivacao

A aplicacao principal (NestJS) ja tinha um modulo de autenticacao interno
(`AuthModule`, `JwtStrategy`, `RolesGuard`) para funcionarios (ADMIN,
MECANICO, ATENDENTE), mas nao tinha nenhum fluxo de login para clientes.
A Fase 3 pede explicitamente uma funcao serverless dedicada para
autenticacao por CPF, como um dos 4 repositorios independentes, decidida
com o objetivo de: (a) demonstrar uma arquitetura de auth desacoplada
("Backend for Auth" separado do backend de dominio), e (b) escalar
autenticacao independentemente do resto da aplicacao (autenticacao tende a
ter picos de trafego diferentes do resto do dominio).

## Alternativas consideradas

1. **Adicionar um endpoint de login por CPF direto no NestJS**: mais simples
   (sem Lambda/API Gateway adicionais), mas nao atende ao requisito
   explicito de uma funcao serverless dedicada, e acopla o ciclo de deploy
   da autenticacao ao ciclo de deploy do dominio (Repositorio 4).
2. **Lambda com Amazon Cognito**: descartado - Cognito adiciona uma camada de
   identidade completa (User Pools, hosted UI) desproporcional para o caso
   de uso ("cliente informa CPF, recebe token") e teria custo por usuario
   ativo mensal (MAU) fora do escopo do free tier gratuito indefinidamente.
3. **Lambda emitindo JWT proprio (escolhida)**: sem dependencia de um
   provedor de identidade externo, reaproveita a mesma logica de
   `JwtStrategy`/`RolesGuard` ja existente na aplicacao principal (o token
   emitido pela Lambda e aceito pelo NestJS **sem nenhuma mudanca de
   codigo** no `JwtStrategy`, so exigiu adicionar `Role.CLIENTE` ao enum).

## Decisao

1. Validacao de CPF (modulo 11) implementada do zero na Lambda, sem
   biblioteca externa.
2. A Lambda consulta a tabela `clientes` (coluna `documento`) diretamente no
   RDS do Repositorio 1, dentro da mesma VPC (Security Group dedicado,
   acesso restrito por referencia de SG, nao CIDR).
3. Credenciais do RDS injetadas na Lambda **no momento do deploy**
   (`terraform apply`, rodando fora da VPC) via variavel de ambiente, **nao**
   lidas em runtime via Secrets Manager/SSM - evita a necessidade de NAT
   Gateway ou VPC Interface Endpoint (~US$15-35/mes) so para a Lambda
   alcancar a API da AWS de dentro da VPC privada.
4. Token JWT assinado com HS256, mesmo `JWT_SECRET` da aplicacao principal
   (compartilhado via GitHub Secrets entre os Repositorios 2 e 4), payload
   `{ sub: clienteId, role: "CLIENTE" }` - formato identico ao ja usado
   internamente pelo NestJS (`{ sub, role }`).
5. Um segredo espelho e publicado no AWS Secrets Manager (Repositorio 2)
   para fins de auditabilidade/rotacao, mesmo a Lambda nao o consultando em
   runtime - atende ao padrao pedido no enunciado da Sprint 2 sem abrir mao
   da economia de custo da injecao em deploy-time.

## Consequencias

- Positivas: zero acoplamento em runtime entre Repositorio 2 e Repositorio 4
  (nenhuma chamada de rede entre eles); JWT validado localmente pelo NestJS
  (sem round-trip para verificar o token); custo de rede zero (sem NAT/VPC
  endpoint).
- Negativas: rotacionar a senha do banco exige um novo `terraform apply` no
  Repositorio 2 (a Lambda nao re-le a credencial sozinha); o
  `JWT_SECRET` precisa ser mantido manualmente sincronizado entre os
  Repositorios 2 e 4 (nenhum mecanismo automatico de sincronizacao entre
  os GitHub Secrets dos dois repositorios).
- Pendencia conhecida: o enum `Role` da aplicacao principal precisou ganhar
  o valor `CLIENTE`; documentado no README do Repositorio 4.

Relacionado ao PR #fase3-rfc-003
