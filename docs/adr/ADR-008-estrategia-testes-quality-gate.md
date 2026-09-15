# ADR-008 - Estrategia de testes e quality gate

Data: 21/04/2026
Status: Aceita

## Contexto
O desafio exige confiabilidade do fluxo critico da OS e rastreabilidade de qualidade.

## Decisao
Combinar testes de dominio, aplicacao e E2E, com gate minimo para cobertura critica.

## Consequencias
- Positivas: regressao reduzida no fluxo principal.
- Negativas: maior tempo de execucao da pipeline de testes.

Relacionado ao PR #simulado-08
