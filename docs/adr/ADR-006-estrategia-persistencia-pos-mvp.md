# ADR-006 - Estrategia de persistencia pos-MVP

Data: 21/04/2026
Status: Proposta

## Contexto
A persistencia in-memory atende o MVP, mas nao atende requisitos de durabilidade para producao.

## Decisao
Planejar migracao para persistencia robusta em fase posterior, sem implementar nesta entrega.

## Consequencias
- Positivas: preserva foco no MVP sem bloquear evolucao futura.
- Negativas: exige planejamento de migracao quando houver mudanca de fase.

Relacionado ao PR #simulado-06
