# ADR-001 - Modelagem de dominio com DDD

Data: 21/04/2026
Status: Aceita

## Contexto
A oficina precisava de um modelo com regras de negocio previsiveis para o ciclo de vida da OS.

## Decisao
Adotar DDD no nucleo de dominio, com `OrdemServico` como aggregate root e regras de status centralizadas no dominio.

## Consequencias
- Positivas: consistencia das transicoes de estado, melhor testabilidade das regras.
- Negativas: necessidade de disciplina para nao mover regra de negocio para controllers.

Relacionado ao PR #simulado-01
