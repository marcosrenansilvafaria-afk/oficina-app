# oficina-app

Aplicação principal (NestJS, Clean Architecture/DDD) do projeto **oficina**,
adaptada para rodar no cluster **EKS** (Repositório 3), consumindo o **RDS
PostgreSQL** (Repositório 1) e validando tokens **JWT** emitidos pela Lambda
de autenticação por CPF (Repositório 2). Este é o **Repositório 4** da Fase 3
do Tech Challenge:

| # | Repositório | Responsabilidade |
|---|---|---|
| 1 | oficina-db-infrastructure | Banco de dados gerenciado (RDS PostgreSQL) |
| 2 | oficina-lambda-auth | Lambda de autenticação por CPF + API Gateway |
| 3 | oficina-k8s-infrastructure | Cluster Kubernetes gerenciado (EKS) |
| 4 | **oficina-app** (este) | Aplicação NestJS + observabilidade |

## Sumário

- [Propósito](#propósito)
- [Integração com os outros repositórios](#integração-com-os-outros-repositórios)
- [Observabilidade](#observabilidade)
- [Execução local](#execução-local)
- [Swagger / OpenAPI](#swagger--openapi)
- [Deploy no EKS](#deploy-no-eks)
- [Acessar a API e os dashboards ao vivo](#acessar-a-api-e-os-dashboards-ao-vivo)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Limitação conhecida](#limitação-conhecida)

## Propósito

Gerenciar Ordens de Serviço de uma oficina mecânica (Clean Architecture/DDD),
agora rodando em Kubernetes gerenciado (EKS), com autenticação de clientes
via JWT emitido por uma Lambda separada, logs estruturados, métricas
Prometheus e dashboards prontos para importação.

## Integração com os outros repositórios

- **RDS (Repo 1)**: a `DATABASE_URL`/`DB_HOST` são injetadas via Secret/ConfigMap
  populados pelo CI a partir de outputs do Repositório 1 (não há Terraform
  aqui — este repo só consome credenciais já existentes).
- **JWT da Lambda (Repo 2)**: o `JwtStrategy` já validava tokens `{ sub, role }`
  assinados com `JWT_SECRET` — **nenhuma mudança de código foi necessária**.
  Só adicionamos `Role.CLIENTE` ao enum e aplicamos `@Roles(Role.CLIENTE, ...)`
  na rota `GET /os/:id/status` (cliente acompanha sua própria OS). **O
  `JWT_SECRET` deste repositório precisa ser identico ao do Repositório 2**,
  senão os tokens da Lambda são rejeitados.
- **EKS (Repo 3)**: o deploy usa `aws eks update-kubeconfig` com uma IAM Role
  dedicada, autorizada via **EKS Access Entry** (adicionada no Repositório 3,
  `access-entries.tf`) a fazer `kubectl apply` apenas no namespace `oficina`.

## Observabilidade

- **Logs estruturados em JSON** via `nestjs-pino`. Cada requisição carrega um
  `x-correlation-id` (reaproveitado do header, se enviado pelo cliente, ou
  gerado como UUID) — presente em todo log daquela requisição e devolvido na
  resposta, permitindo rastrear uma chamada ponta a ponta entre serviços.
- **Métricas Prometheus** em `GET /metrics` (`prom-client`):
  - `oficina_ordens_servico_created_total` — dashboard de volume diário de OS.
  - `oficina_ordem_servico_status_duration_seconds` (histogram, por `status`) —
    dashboard de tempo médio de execução por status.
  - `oficina_integration_errors_total` — dashboard de taxa de erros/falhas.
  - `http_request_duration_seconds` — latência HTTP por rota/método/status.
- **Healthcheck** em `GET /health` (`@nestjs/terminus`), checa conectividade
  com o RDS.
- **Dashboards Grafana prontos** em [`observability/dashboards/`](observability/dashboards/)
  (3 arquivos JSON, um por métrica exigida pelo edital) — **não instalamos
  Prometheus/Grafana no cluster** (o node único `t3.small` do Repositório 3
  não tem folga de recursos para isso); os dashboards são para importar em
  qualquer instância Grafana já apontada para scrapear `/metrics` deste app.

## Execução local

```bash
docker-compose up --build
```

Sobe Postgres local + a API em `http://localhost:3000`. Migrations rodam
automaticamente no boot (`RUN_MIGRATIONS_ON_BOOT` não definido = `true` por
default local).

## Swagger / OpenAPI

`http://localhost:3000/docs` (local) ou, após o `kubectl port-forward`
(seção abaixo), `http://localhost:3000/docs` também.

## Deploy no EKS

Pipeline definida em [`.github/workflows/ci-cd-app.yml`](.github/workflows/ci-cd-app.yml):

1. **lint-test**: eslint, build, `jest`, `test:cov:critical` (>= 80%).
2. **docker-build-push**: build multi-stage, push para GHCR (`sha-<7chars>`).
3. **deploy** (push `main`, gated por Environment `production`):
   `aws eks update-kubeconfig` → confirma o namespace/ConfigMap/Secret → roda o
   Job de migration e aguarda conclusão → aplica Deployment/Service/HPA →
   aguarda rollout.

### Configuração necessária no GitHub

- **Secrets**: `AWS_ROLE_ARN` (IAM Role deste repo, com EKS Access Entry no
  Repo 3), `DB_HOST`, `DB_PORT`, `DB_NAME`, `DATABASE_URL`, `JWT_SECRET`
  (**idêntico** ao do Repositório 2), `EXTERNAL_WEBHOOK_TOKEN`.
- Branch protection + Environment `production`, mesmo padrão dos demais repositórios.

### Bootstrap manual (uma única vez): namespace do cluster

A IAM Role deste repositório tem acesso ao EKS **escopado ao namespace
`oficina`** (via EKS Access Entry + `AmazonEKSEditPolicy` com
`access_scope` de namespace, configurado no Repositório 3). Isso significa
que ela **não tem permissão RBAC para criar o objeto `Namespace` em si**
(é um recurso de escopo de cluster). Quem administra o cluster (Repositório
3) precisa criar o namespace uma única vez:

```bash
kubectl apply -f k8s/00-namespace.yaml
```

Depois disso, o pipeline de deploy só precisa confirmar que ele existe.

### Nota sobre o claim `sub` do OIDC do GitHub Actions

Ao configurar a IAM Role deste repositório (e das demais), descobrimos que
o claim `sub` do token OIDC do GitHub Actions pode incluir IDs numéricos
imutáveis do usuário/repositório (formato `repo:owner@ID/repo@ID:...`), não
documentado nos exemplos padrão da AWS. A trust policy da IAM Role precisa
de padrões `StringLike` com wildcard (`repo:owner@*/repo@*:...`) para
cobrir esse formato, além do formato tradicional sem ID.

## Acessar a API e os dashboards ao vivo

A API **não tem Load Balancer público** (decisão de custo — ver README do
Repositório 3). Para acessar depois do deploy:

```bash
aws eks update-kubeconfig --name oficina-eks-development --region us-east-1

kubectl port-forward -n oficina svc/oficina-api 3000:3000
```

Com isso, `http://localhost:3000/docs` (Swagger) e `http://localhost:3000/metrics`
ficam acessíveis localmente. Para ver os logs estruturados em tempo real:

```bash
kubectl logs -n oficina -l app=oficina-api -f
```

Para os dashboards, importe os arquivos de [`observability/dashboards/`](observability/dashboards/)
em qualquer Grafana (Settings → Dashboards → Import), apontando o datasource
Prometheus para `http://localhost:3000/metrics` (via um Prometheus configurado
para scrapear esse endpoint, local ou remoto).

## Variáveis de ambiente

Ver [`.env.example`](.env.example). Além das já existentes na Fase 2:
`LOG_LEVEL` (default `info`), `RUN_MIGRATIONS_ON_BOOT` (default `true` local,
`false` no K8s — migrations rodam via Job dedicado).

## Limitação conhecida

O schema original só tinha `criadaEm`/`finalizadaEm` na OS, insuficiente para
medir a duração de cada status individualmente. Adicionamos a tabela
`ordens_servico_status_historico` (migration
`20260915000000_ordem_servico_status_historico`), populada a cada transição
de status pelo próprio controller. OS criadas **antes** desta migration têm
um único evento de histórico (status atual, com `alteradoEm = criadaEm`) —
a métrica de duração por status só é precisa para transições ocorridas
**depois** do deploy desta mudança.
