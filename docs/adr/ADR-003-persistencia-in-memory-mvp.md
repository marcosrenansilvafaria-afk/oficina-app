# ADR-003 - Persistencia inicial in-memory no MVP

Data: 21/04/2026
Status: Aceita

## Contexto
O foco do desafio era validar regras de negocio e fluxo ponta a ponta sem complexidade de infraestrutura.

## Decisao
Utilizar repositorios in-memory no MVP para acelerar entrega e reduzir tempo de setup.

## Consequencias
- Positivas: rapidez no desenvolvimento e testes.
- Negativas: dados nao persistem entre execucoes e nao representa ambiente de producao.

Relacionado ao PR #simulado-03
