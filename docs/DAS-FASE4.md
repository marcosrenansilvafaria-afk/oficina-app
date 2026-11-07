# Design Approval Sheet (DAS) — Fase 4

Projeto: Oficina — Arquitetura de Microsserviços Distribuída
Data: 07/11/2026
Versão: 2.0
Identificador: DAS-OFICINA-FASE4-001

> Esta DAS substitui, para efeito de avaliação da Fase 4, a versão anterior
> ([`DAS.md`](DAS.md), v1.0 — MVP com persistência in-memory em um único
> repositório). O sistema evoluiu através das Fases 1 a 4 até a arquitetura
> distribuída descrita abaixo; a v1.0 é mantida como registro histórico.

## Contexto do Projeto

O projeto digitaliza o fluxo de Ordem de Serviço (OS) de uma oficina
mecânica — da abertura à entrega do veículo — com rastreabilidade completa
de status, orçamento, pagamento e execução do reparo. Começou como um
monolito modular (MVP, Fase 1-2) e evoluiu, na Fase 3, para rodar em nuvem
(AWS EKS + RDS) com autenticação serverless. Na **Fase 4**, o monolito foi
decomposto em **3 microsserviços independentes**, cada um em seu próprio
repositório, dono exclusivo do seu banco de dados, coordenados por um
**Saga Pattern coreografado** via mensageria assíncrona (AWS SNS/SQS FIFO).
O valor para o negócio: cada etapa do atendimento (diagnóstico/orçamento,
pagamento, execução) pode evoluir, escalar e falhar de forma independente,
sem que uma indisponibilidade em um domínio derrube os outros dois.

## Arquitetura de repositórios (8 repositórios independentes)

| # | Repositório | Responsabilidade |
|---|---|---|
| 1 | [oficina-db-infrastructure](https://github.com/marcosrenansilvafaria-afk/oficina-db-infrastructure) | RDS PostgreSQL (Terraform) — compartilhada, 1 database por microsserviço |
| 2 | [oficina-lambda-auth](https://github.com/marcosrenansilvafaria-afk/oficina-lambda-auth) | Autenticação por CPF + JWT (Lambda + API Gateway) |
| 3 | [oficina-k8s-infrastructure](https://github.com/marcosrenansilvafaria-afk/oficina-k8s-infrastructure) | Cluster EKS compartilhado (Terraform) |
| 4 | [oficina-app](https://github.com/marcosrenansilvafaria-afk/oficina-app) | Hub de documentação, dashboards de observabilidade, suíte E2E do Saga (este repositório) |
| 5 | [oficina-messaging-infra](https://github.com/marcosrenansilvafaria-afk/oficina-messaging-infra) | Broker SNS/SQS FIFO + contratos de evento do Saga |
| 6 | [oficina-os-service](https://github.com/marcosrenansilvafaria-afk/oficina-os-service) | Microsserviço de Ordem de Serviço (PostgreSQL próprio) |
| 7 | [oficina-billing-service](https://github.com/marcosrenansilvafaria-afk/oficina-billing-service) | Microsserviço de orçamento/pagamento (DynamoDB, integração Mercado Pago) |
| 8 | [oficina-execution-service](https://github.com/marcosrenansilvafaria-afk/oficina-execution-service) | Microsserviço de fila de produção/execução (PostgreSQL próprio) |

Cada um dos 3 microsserviços (6, 7, 8) tem CI/CD independente (lint, build,
testes + gate de cobertura ≥80%, build/push de imagem Docker, deploy no
EKS), branch protection e pipeline própria — nenhum depende do pipeline dos
outros para ser validado ou publicado.

## Requisitos do sistema

**Funcionais:**
- Criação e consulta de Ordem de Serviço; fluxo completo: diagnóstico →
  itens (peças/serviços) → orçamento → aprovação/recusa → execução →
  finalização → entrega.
- Geração de orçamento e cobrança real via Mercado Pago (PIX/Checkout),
  com confirmação assíncrona por webhook.
- Fila de produção, atribuição de mecânico e execução do reparo, com
  possibilidade de falha técnica (compensação).
- Gestão de cliente, veículo, peça e serviço (catálogo).
- Autenticação por CPF (serverless) + autorização JWT/RBAC.
- Consistência transacional **distribuída** entre os 3 domínios via Saga
  (fluxo feliz e 2 cenários de compensação/rollback).

**Não-funcionais:**
- Database-per-service: nenhum microsserviço acessa o banco de outro
  diretamente (isolamento de rede e de código).
- Autoscaling horizontal (HPA) por microsserviço no EKS.
- Observabilidade: logs estruturados em JSON com `correlationId`
  propagado entre os 3 serviços via Saga; métricas Prometheus (`/metrics`)
  e healthcheck (`/health`) em cada serviço; 3 dashboards Grafana
  versionados.
- Cobertura de testes ≥80% em cada microsserviço, com gate no CI — tanto
  na camada crítica (domínio/aplicação) quanto no **repositório inteiro**
  (94-96% statements/lines nos 3 serviços); testes BDD (Gherkin) do ciclo
  de vida de cada agregado; suíte E2E validando a coreografia real entre
  os 3 serviços contra infraestrutura AWS real.
- Validação de qualidade de código via **SonarCloud**, com scan automático
  a cada push/PR nos 3 microsserviços, consumindo a cobertura do
  repositório inteiro (não só a crítica).
- Segurança: validação de CPF/CNPJ e placa; webhook do Mercado Pago nunca
  confia no corpo da notificação, sempre reconsulta o pagamento real.

## Arquitetura e tecnologias

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Backend (3 microsserviços) | NestJS + TypeScript, Clean Architecture/DDD | Mesmo padrão arquitetural do monolito original — curva de aprendizado zero entre fases |
| Persistência relacional | PostgreSQL (RDS) + Prisma 7 | OS Service e Execution Service têm domínio relacional com integridade referencial |
| Persistência NoSQL | DynamoDB (`PAY_PER_REQUEST`) | Billing Service tem acesso por chave (`ordemServicoId`/`mercadoPagoPaymentId`), sem necessidade de `JOIN`s |
| Mensageria/Saga | AWS SNS FIFO + SQS FIFO/DLQ | Coordena a transação distribuída sem custo ocioso (serverless) e sem coordenador central |
| Autenticação | AWS Lambda + API Gateway + JWT/RBAC | Desacoplada dos 3 microsserviços — qualquer um valida o mesmo token |
| Orquestração | Kubernetes (AWS EKS) | Autoscaling (HPA) e deploy automatizado via CI/CD |
| IaC | Terraform (4 repositórios de infraestrutura) | Reprodutibilidade e versionamento da infraestrutura |
| Integração de pagamento | SDK oficial Mercado Pago v2 + gateway fake para dev/CI | Testável sem rede externa; webhook sempre reconsulta o pagamento real |
| Observabilidade | `nestjs-pino` (JSON) + `prom-client` + Grafana (externo) | Sem custo de hospedar Prometheus/Grafana dentro do cluster |
| Testes | Jest (unitário/cobertura) + Cucumber/Gherkin (BDD) + suíte E2E própria | Cobertura isolada por serviço + validação de integração real |
| Qualidade de código | SonarCloud (scan via CI, análise automática desativada) | Mesma cobertura real (`coverage/lcov.info`) usada no gate de teste alimenta o Sonar |

Justificativa completa de cada decisão nos ADRs e RFCs (seção abaixo).

## Estrutura da arquitetura (C4 Model)

**Contexto (C1):** Atendentes e mecânicos interagem com os 3 microsserviços
via API HTTP (autenticada por JWT, emitido pela Lambda de autenticação);
o Billing Service interage externamente com o Mercado Pago (cobrança e
webhook).

**Container (C2):** 3 aplicações NestJS independentes (OS, Billing,
Execution), cada uma com seu próprio banco; 1 broker de mensageria (SNS
FIFO + 3 filas SQS FIFO + DLQs); 1 cluster EKS compartilhado hospedando os
3 (quando provisionado); 1 Lambda de autenticação; dashboards Grafana
externos.

**Componentes (C3):** em cada microsserviço — controllers HTTP, use-cases
de aplicação, entidades de domínio, repositórios (Prisma ou DynamoDB SDK),
publisher/consumer do Saga (SNS/SQS), módulo de observabilidade
(logs/métricas/health).

Diagrama C4 completo (contexto/container/componentes) da Fase 3 em
[`docs/diagram/`](diagram/) (`c4-context.puml`, `c4-container.puml`,
`c4-component.puml`); evolução para a Fase 4 representada no diagrama
geral abaixo.

## Diagramas de arquitetura

- [Diagrama geral de componentes — Fase 4](diagram/fase4-componentes.mmd)
  (visão cloud: 3 microsserviços, SNS/SQS, RDS, DynamoDB, Grafana)
- [Saga — fluxo feliz](diagram/fase4-saga-happy-path.mmd)
- [Saga — fluxos de compensação](diagram/fase4-saga-compensacao.mmd)
- ERDs por serviço: [`modelo-dados.md` — Fase 4](modelo-dados.md#fase-4--database-per-service)
- Diagramas C4 (Fase 3, ainda válidos para a camada de autenticação/infra):
  [`diagram/c4-context.puml`](diagram/c4-context.puml),
  [`diagram/c4-container.puml`](diagram/c4-container.puml),
  [`diagram/c4-component.puml`](diagram/c4-component.puml)

## Restrições e decisões técnicas

- **Conta AWS Academy com orçamento de créditos limitado**: o cluster EKS
  (~US$120/mês rodando continuamente, control plane + node + NAT Gateway)
  e a RDS ficam **destruídos entre validações**, recriados via Terraform
  apenas quando necessário (ex.: para a gravação do vídeo de evidência).
  O deploy no EKS é gateado pela variável `EKS_DEPLOY_ENABLED` em cada
  pipeline — quando o cluster não existe, o job de deploy aparece como
  `skipped`, nunca como falha travada.
- **Saga coreografado, não orquestrado**: evita um 4º serviço coordenador
  só para esse fim (ver [RFC-004](rfc/RFC-004-saga-pattern-mensageria.md)).
- **Database-per-service híbrido** (SQL + NoSQL): cada serviço usa o
  modelo de dados adequado ao seu domínio, não um padrão único forçado
  (ver [ADR-016](adr/ADR-016-database-per-service-hibrido.md)).
- **1 instância RDS compartilhada, não 1 por serviço**: isolamento
  garantido por database + usuário/role próprios dentro da mesma
  instância, não por instâncias separadas — decisão de custo.
- **Gateway fake do Mercado Pago em dev/CI**: nenhuma chamada de rede real
  a um provedor de pagamento nos testes automatizados (ver
  [ADR-017](adr/ADR-017-integracao-mercadopago-webhooks.md)).

## Documentação de requisitos funcionais e não-funcionais

Consolidada, com rastreabilidade por fase e sprint, em
[DOCUMENTACAO_ARQUITETURA.md](DOCUMENTACAO_ARQUITETURA.md) — ver
especialmente as seções "Entregáveis Fase 4 — Sprint 1" a "Sprint 6-1".

## Diagrama de implantação e configuração

- Cada microsserviço: imagem Docker multi-stage, publicada no GHCR via CI,
  implantada no EKS (namespace `oficina`) via `kubectl apply` dos
  manifests versionados em `k8s/` de cada repositório (ConfigMap, Secret,
  Job de migration, Deployment, Service, HPA).
- Execução/validação local sem AWS: `docker-compose.yml` de cada
  microsserviço (Postgres ou DynamoDB-local); validação da integração
  real entre os 3 via
  [`oficina-app/test/saga-e2e/`](https://github.com/marcosrenansilvafaria-afk/oficina-app/tree/main/test/saga-e2e)
  (`docker-compose.saga-e2e.yml`), contra o SNS/SQS FIFO real da AWS.
- Instruções completas de execução local em cada README (seção "Execução
  local").

## ADR (Architecture Decision Record)

18 ADRs em [`docs/adr/`](adr/README.md), cobrindo desde a modelagem de
domínio (Fase 1) até a decomposição em microsserviços (Fase 4). Mais
relevantes para a Fase 4:

- [ADR-012](adr/ADR-012-segregacao-4-repositorios-cicd.md) — Segregação em
  repositórios independentes com CI/CD próprio
- [ADR-016](adr/ADR-016-database-per-service-hibrido.md) — Database-per-service híbrido (SQL + NoSQL)
- [ADR-017](adr/ADR-017-integracao-mercadopago-webhooks.md) — Integração Mercado Pago via webhook
- [ADR-018](adr/ADR-018-estrategia-testes-bdd-cobertura.md) — Estratégia de testes BDD + cobertura ≥80%

RFCs em [`docs/rfc/`](rfc/README.md), com destaque para
[RFC-004](rfc/RFC-004-saga-pattern-mensageria.md) — Saga Pattern
coreografado e mensageria serverless.

## Plano de testes e monitoramento

**Testes** (por microsserviço, gate no CI antes do build da imagem):
- Unitários + cobertura ≥80%, com 2 gates: crítico (`domain/`+`application/`)
  e do repositório inteiro. Evidência real (`test:cov`, repositório
  inteiro):

  | Serviço | Statements | Branches | Functions | Lines |
  |---|---|---|---|---|
  | OS Service | 95,59% | 86,18% | 96,44% | 95,66% |
  | Billing Service | 95,21% | 82,23% | 94,56% | 95,27% |
  | Execution Service | 94,54% | 84,47% | 94,8% | 94,33% |

- Validação de qualidade de código via **SonarCloud**: scan automático a
  cada push/PR nos 3 microsserviços (job `sonarqube` do CI), consumindo a
  cobertura do repositório inteiro (`coverage/lcov.info`) — não a Análise
  Automática nativa do SonarCloud (desativada, pois não executa os testes
  e não teria acesso à cobertura real).
- BDD (Cucumber/Gherkin) do ciclo de vida do agregado principal.
- Suíte E2E do Saga (`oficina-app/test/saga-e2e/`, manual/local, fora do
  CI): 3 cenários — fluxo feliz, compensação por pagamento recusado,
  compensação por falha de execução — validados contra SNS/SQS/RDS/DynamoDB
  reais. Evidência de execução real em
  [SAGA_PATTERN_SPEC.md — Evidências de validação E2E](SAGA_PATTERN_SPEC.md#evidências-de-validação-e2e-sprint-5).

**Monitoramento:**
- `GET /health` (conectividade real com o banco) e `GET /metrics`
  (Prometheus) em cada um dos 3 microsserviços.
- `correlationId` (`= ordemServicoId`) presente em todo log estruturado,
  do publish do evento no serviço de origem ao consume no destino —
  permite reconstruir o trace completo de uma Saga entre os 3 serviços.
- 3 dashboards Grafana versionados em
  [`observability/dashboards/`](https://github.com/marcosrenansilvafaria-afk/oficina-app/tree/main/observability/dashboards)
  (volume diário de OS, tempo médio por status, taxa de erros de
  integração do Saga).

## Modelo de dados

Ver [modelo-dados.md](modelo-dados.md) — ERD completo do monolito (Fase
2/3) e, na seção [Fase 4 — Database-per-service](modelo-dados.md#fase-4--database-per-service),
os ERDs isolados do OS Service (PostgreSQL), Execution Service
(PostgreSQL) e o modelo de acesso do Billing Service (DynamoDB).

## Documentação de API

Cada microsserviço expõe Swagger/OpenAPI em `/docs` e tem sua lista de
endpoints HTTP documentada no próprio README:

| Serviço | Swagger local | Endpoints (README) |
|---|---|---|
| OS Service | `http://localhost:3001/docs` | [oficina-os-service#endpoints-http](https://github.com/marcosrenansilvafaria-afk/oficina-os-service#endpoints-http) |
| Billing Service | `http://localhost:3002/docs` | [oficina-billing-service#endpoints-http](https://github.com/marcosrenansilvafaria-afk/oficina-billing-service#endpoints-http) |
| Execution Service | `http://localhost:3003/docs` | [oficina-execution-service#endpoints-http](https://github.com/marcosrenansilvafaria-afk/oficina-execution-service#endpoints-http) |

Mapeamento de eventos consumidos/publicados por cada serviço no Saga: ver
seção "Saga Pattern" do README de cada um, e os contratos versionados em
[`oficina-messaging-infra/contracts/`](https://github.com/marcosrenansilvafaria-afk/oficina-messaging-infra/tree/main/contracts).

## Evidência em vídeo

Pendente — a ser gravado demonstrando: (1) pipeline de CI/CD rodando do
zero (lint/test → build → deploy) e (2) o deploy automatizado de pelo
menos um microsserviço rodando de fato no cluster EKS. Roteiro de
provisionamento sob demanda (dado o orçamento limitado da conta AWS
Academy) documentado internamente; link do vídeo será adicionado aqui
quando gravado.

## Referências

- [DOCUMENTACAO_ARQUITETURA.md](DOCUMENTACAO_ARQUITETURA.md) — índice
  completo de entregáveis por fase/sprint
- [SAGA_PATTERN_SPEC.md](SAGA_PATTERN_SPEC.md)
- [modelo-dados.md](modelo-dados.md)
- [docs/adr/README.md](adr/README.md), [docs/rfc/README.md](rfc/README.md)
- [DAS.md](DAS.md) — versão 1.0 (MVP), histórico
