# ADR-018 - Estrategia de testes BDD + gate de cobertura critica >= 80%

Data: 04/11/2026
Status: Aceita

## Contexto
ADR-008 (Fase 2) ja estabelecia um gate de cobertura critica sobre o
dominio/aplicacao do monolito. Na Fase 4, com 3 microsservicos
independentes e um fluxo de negocio (o Saga) que atravessa os 3, surgem 2
necessidades novas: (1) repetir o gate de cobertura em cada repositorio,
de forma isolada (nenhum servico deve cair de qualidade so porque os
outros estao cobertos); (2) expressar o comportamento do ciclo de vida de
cada dominio (OS, orcamento/pagamento, execucao) de forma legivel por
alguem fora do time tecnico - motivando a adocao de BDD.

## Alternativas consideradas
1. **So testes unitarios/integracao, sem BDD**: mais rapido de escrever,
   mas o comportamento do ciclo de vida de cada entidade (transicoes de
   status validas/invalidas) fica implicito no codigo de teste, nao
   documentado em linguagem de negocio.
2. **BDD com um framework proprio por servico** (ex: Jest puro simulando
   Gherkin): descartado por inconsistencia - cada servico escreveria
   "BDD" de um jeito diferente, perdendo o beneficio de um formato comum.
3. **Cucumber/Gherkin + Jest, replicado nos 3 microsservicos (escolhida)**:
   mesmo padrao usado desde a Fase 2 no monolito, consistente entre os 3
   repositorios novos.

## Decisao
- **BDD** (`npm run test:bdd`): cenarios `.feature` em Gherkin descrevendo
  o ciclo de vida do agregado principal de cada servico sob a perspectiva
  do Saga:
  - **OS Service**: criacao -> diagnostico -> orcamento -> aprovacao/recusa
    -> execucao -> finalizacao, incluindo os 2 fluxos de compensacao.
  - **Billing Service**: geracao de orcamento -> cobranca -> webhook
    aprovado/recusado -> (se aplicavel) reembolso.
  - **Execution Service**: entrada na fila -> inicio -> conclusao ou falha
    (compensacao).
- **Cobertura critica >= 80%** (`npm run test:cov:critical`), gate separado
  da cobertura global (mesmo padrao de ADR-008): aplicado sobre
  `domain/` e `application/` de cada servico - as camadas que concentram
  regra de negocio - nao sobre `infraestructure/` (adapters de
  banco/mensageria, mais barato de cobrir por teste de integracao do que
  unitario, e com menor risco de regressao silenciosa).
- **Gate roda no CI de cada repositorio** (job `Lint & Test`), antes do
  build/push da imagem Docker - um PR com cobertura abaixo de 80% ou um
  cenario BDD quebrado nunca chega a gerar uma imagem publicavel.
- **Validacao adicional de ponta a ponta** (fora do CI, manual): a suite
  `test/saga-e2e/` do `oficina-app` (Sprint 5) complementa o BDD de cada
  servico isolado validando a coreografia real entre os 3 processos contra
  infraestrutura AWS real (SNS/SQS/RDS/DynamoDB) - o BDD cobre cada
  servico isoladamente, a suite E2E cobre a integracao entre eles.

## Consequencias
- Positivas: regra de negocio de cada dominio documentada em linguagem
  legivel (Gherkin), nao so em asserts de teste; gate de cobertura impede
  queda de qualidade silenciosa em qualquer um dos 3 repositorios;
  separacao clara entre "o que cada servico garante sozinho" (BDD/unitario,
  automatizado no CI) e "o que so aparece na integracao real" (E2E,
  manual/local).
- Negativas: a suite E2E nao roda no CI (depende de AWS real e dos 3
  repositorios como containers simultaneos) - fica como validacao manual
  documentada, nao como gate automatico; manter cenarios BDD coerentes
  entre os 3 servicos exige disciplina (nao ha um unico lugar que valide
  que os 3 Gherkins continuam narrando a mesma historia de negocio).

Relacionado ao PR #fase4-sprint6-1-documentacao
