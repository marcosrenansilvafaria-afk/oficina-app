# Simulação E2E do Saga (Sprint 5 — Fase 4)

Valida o Saga coreografado entre os 3 microsserviços reais
(`oficina-os-service`, `oficina-billing-service`,
`oficina-execution-service`), publicando/consumindo eventos no **SNS/SQS
FIFO real** provisionado em `oficina-messaging-infra` (Sprint 1) — não um
emulador/mock. Ver [`docs/SAGA_PATTERN_SPEC.md`](../../docs/SAGA_PATTERN_SPEC.md)
para o desenho completo do Saga e as evidências desta sprint.

Ferramenta de **validação manual local**, fora do `npm test`/CI de
qualquer um dos 4 repositórios: depende de credenciais AWS reais e dos 3
repositórios de serviço clonados como irmãos deste (`oficina-app`), o que
não é reproduzível num runner de CI isolado sem credenciais de longa
duração (fora do escopo desta sprint).

## Pré-requisitos

1. Os 3 repositórios de serviço clonados como pastas irmãs de `oficina-app`:
   ```
   projects/
   ├── oficina-app/              (este repositorio)
   ├── oficina-os-service/
   ├── oficina-billing-service/
   └── oficina-execution-service/
   ```
2. Docker Desktop rodando.
3. Sessão AWS ativa com permissão de publish/receive/delete no tópico
   `oficina-saga-events.fifo` e nas filas `oficina-saga-{os,billing,execution}-service.fifo`
   (`aws login` — mesmo fluxo já usado nas sprints anteriores). Exporte as
   credenciais da sessão como variáveis de ambiente antes de subir os
   containers:
   ```sh
   # exemplo tipico apos aws login/sso - ajuste ao seu fluxo de credenciais
   eval "$(aws configure export-credentials --format env)"
   ```

## Como rodar

```sh
# na raiz de oficina-app
docker compose -f docker-compose.saga-e2e.yml up --build -d
npm run test:saga-e2e
docker compose -f docker-compose.saga-e2e.yml down
```

Os 3 serviços sobem em `localhost:3001` (OS), `:3002` (Billing — com o
`FakeMercadoPagoGateway`, já que não há credenciais de sandbox reais do
Mercado Pago configuradas; pendência documentada desde a Sprint 3) e
`:3003` (Execution). `npm run test:saga-e2e` roda os 3 cenários
sequencialmente (`--runInBand` — obrigatório, já que os 3 testes
compartilham o estado do `FakeMercadoPagoGateway` do container do
Billing, uma única instância de processo).

## Cenários

- `saga-happy-path.e2e-spec.ts` — abertura da OS até `FINALIZADA`.
- `saga-compensacao-pagamento.e2e-spec.ts` — pagamento recusado → OS
  volta para `EM_DIAGNOSTICO`.
- `saga-compensacao-execucao.e2e-spec.ts` — falha técnica na execução →
  OS e Execução canceladas, Billing reembolsa.

Cada teste loga `correlationId=<ordemServicoId>` a cada passo — útil para
cruzar com os logs estruturados (JSON/pino) dos 3 containers
(`docker compose -f docker-compose.saga-e2e.yml logs -f`).

## Limitações conhecidas

- Depende do Docker Desktop estar operacional no host — já foi um
  bloqueio recorrente nas Sprints 2-4 deste projeto.
- Usa o gateway fake do Mercado Pago (sem credenciais de sandbox reais) e
  um banco Postgres/DynamoDB-local efêmero (sem persistência entre runs).
- Não é executado em CI (ver nota acima).
