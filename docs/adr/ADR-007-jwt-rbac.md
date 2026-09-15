# ADR-007 - Autenticacao JWT com RBAC

Data: 21/04/2026
Status: Aceita

## Contexto
Era necessario controlar acesso aos endpoints criticos com seguranca basica no MVP.

## Decisao
Implementar JWT (access token) e RBAC com perfis atendente, mecanico e admin.

## Consequencias
- Positivas: controle de acesso por perfil com baixo custo de implementacao.
- Negativas: sem refresh token e revogacao avancada no MVP.

Relacionado ao PR #simulado-07
