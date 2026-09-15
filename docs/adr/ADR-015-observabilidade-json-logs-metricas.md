# ADR-015 - Observabilidade com logs em JSON (correlation ID), metricas Prometheus e dashboards

Data: 15/09/2026
Status: Aceita

## Contexto
A Fase 2 tinha observabilidade minima (ADR-010): timestamps simples no
fluxo de OS e respostas HTTP com erros coerentes, sem logs estruturados,
sem correlacao entre requisicoes, e sem metricas exportadas. A Fase 3 exige
logs estruturados em JSON com correlation ID, metricas de negocio
(volume diario de OS, tempo medio por status, taxa de erros) e dashboards
prontos.

## Decisao
- **Logs**: adotado `nestjs-pino` (JSON estruturado nativo), com
  `x-correlation-id` reaproveitado do header da requisicao (se enviado) ou
  gerado como UUID, presente em todo log daquela requisicao e devolvido na
  resposta.
- **Metricas**: `prom-client` via um registro proprio (nao usa o pacote
  `@willsoto/nestjs-prometheus` para manter consistencia com o padrao de
  singletons ja usado no resto da aplicacao, ver `infraestructure/singletons.ts`),
  expostas em `GET /metrics`:
  - `oficina_ordens_servico_created_total` (Counter) - volume diario de OS.
  - `oficina_ordem_servico_status_duration_seconds` (Histogram, label
    `status`) - tempo medio de execucao por status.
  - `oficina_integration_errors_total` (Counter) - taxa de erros/falhas.
  - `http_request_duration_seconds` (Histogram) - latencia HTTP.
- **Healthcheck**: `GET /health` via `@nestjs/terminus`, checando
  conectividade real com o RDS (`SELECT 1`).
- **Dashboards**: 3 arquivos JSON versionados em `observability/dashboards/`,
  importaveis em qualquer Grafana - **sem instalar Prometheus/Grafana
  dentro do cluster EKS**, decisao de custo/recurso: o unico node
  `t3.small` do Repositorio 3 nao tem folga de CPU/memoria para rodar uma
  stack de monitoramento completa junto com a aplicacao.
- **Tabela de historico de status** (`OrdemServicoStatusHistorico`,
  ver documento de modelo de dados) criada especificamente para viabilizar
  a metrica de duracao por status - o schema original so tinha
  `criadaEm`/`finalizadaEm`, insuficiente para medir cada etapa
  individualmente.

## Consequencias
- Positivas: rastreamento ponta a ponta de uma requisicao via
  `correlation-id` (util para depurar falhas entre Lambda e app, mesmo sem
  comunicacao direta entre os dois); metricas de negocio exigidas pelo
  edital todas expostas e testadas contra o cluster real; sem custo
  adicional de infraestrutura de observabilidade.
- Negativas: sem um Prometheus real coletando as metricas continuamente,
  os dashboards so mostram dados quando alguem efetivamente configurar um
  Prometheus (local ou remoto) apontando para `/metrics` - nao ha
  monitoramento "ao vivo" pronto para uso imediato, apenas a capacidade de
  gerar e consumir as metricas quando necessario.
- OS criadas antes da migration da tabela de historico tem apenas 1 evento
  de historico (status atual, com `alteradoEm = criadaEm`) - a metrica de
  duracao por status so e precisa para transicoes ocorridas depois do
  deploy desta mudanca.

Relacionado ao PR #fase3-adr-015
