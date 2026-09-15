# ADR-002 - Estrutura em Clean Architecture

Data: 21/04/2026
Status: Aceita

## Contexto
Era necessario organizar responsabilidades para reduzir acoplamento ao framework.

## Decisao
Manter estrutura em camadas: Domain, Application, Interfaces e Infrastructure, em monolito modular.

## Consequencias
- Positivas: separacao de responsabilidades e evolucao mais segura.
- Negativas: mais arquivos e contratos para mudancas simples.

Relacionado ao PR #simulado-02
