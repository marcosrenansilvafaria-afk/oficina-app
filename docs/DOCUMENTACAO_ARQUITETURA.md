# Documentação de Arquitetura — Oficina mecânica (MVP)

- Projeto: Tech challenge — Software Architecture — Fase 2
- Autor: Marcos Renan Silva Faria (RM373221) — Discord: natsumetks
- Data: 

## Sumário

- [1. Introdução](#1-introdução)
- [2. Requisitos](#2-requisitos)
- [3. Modelagem de Domínio (DDD)](#3-modelagem-de-domínio-ddd)
- [4. Arquitetura (Clean Architecture)](#4-arquitetura-clean-architecture)
- [5. API](#5-api)
- [6. Segurança](#6-segurança)
- [7. Testes](#7-testes)
- [8. Infraestrutura](#8-infraestrutura)
- [9. Qualidade de Software](#9-qualidade-de-software)
- [10. Análise de Vulnerabilidades](#10-análise-de-vulnerabilidades)
- [11. Execução do Projeto](#11-execução-do-projeto)
- [12. Considerações Finais](#12-considerações-finais)

## Entregáveis Fase 2
- Vídeo Fase 2 : [docs/video/apresentacao-fase-2.txt](../docs/video/apresentacao-fase-2.txt)

### (código + banco)
- Repositório: https://github.com/marcosrenansilvafaria-afk/oficina-fiap.git
- Documentação de arquitetura (atualizada): [docs/DOCUMENTACAO_ARQUITETURA.md](../docs/DOCUMENTACAO_ARQUITETURA.md)
- Schema Prisma: [prisma/schema.prisma](../prisma/schema.prisma)

### (IaC + Kubernetes)
- Terraform (cluster + banco + metrics-server + recursos K8s da app): [infra/](../infra/)
- Manifestos K8s gerenciados via Terraform (Deployment, Service, ConfigMap, Secret, HPA, Job): [infra/manifests/](../infra/manifests/)
- Dockerfile multi-stage: [Dockerfile](../Dockerfile)
- Docker compose: [docker-compose.yml](../docker-compose.yml)
- Entrypoint de migration automática: [docker-entrypoint.sh](../docker-entrypoint.sh)

### (CI/CD)
- Pipeline GitHub Actions: [../github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml)
- Imagens publicadas em: `ghcr.io/marcosrenansilvafaria-afk/oficina-fiap`


## Entregáveis Fase 1

- Drawio (online): https://drive.google.com/file/d/1Gv8bTQnPdIEIPBtMnt4wfpOyKGaOIXs8/view?usp=sharing
- Drawio (local): [oficina-mecanica-drawio.drawio](oficina-mecanica-drawio.drawio)
- DAS: [DAS.md](DAS.md)
- Contexto: [ref/contexto-fase-1.md](ref/contexto-fase-1.md)
- Débitos técnicos: [debitos_tecnicos.md](debitos_tecnicos.md)
- Relatório Sonar: [relatorios/sonar-relatorio-final.md](relatorios/sonar-relatorio-final.md)
- README: [../README.md](../README.md)
- Repositório: https://github.com/marcosrenansilvafaria-afk/oficina-fiap.git
- Vídeo (demonstração em 07:50:00): [docs/video/apresentacao-fase-1.txt](docs/video/apresentacao-fase-1.txt)


---

# 1. Introdução

## 1.1 Contexto do problema

A oficina mecânica enfrentava problemas operacionais devido ao uso de processos manuais e planilhas, resultando em:

- Falhas no controle de serviços
- Dificuldade no acompanhamento do status das ordens
- Perda de histórico de clientes e veículos
- Ineficiência no fluxo de aprovação de orçamentos

O sistema proposto busca centralizar e organizar esses processos, garantindo rastreabilidade e controle.

## 1.2 Objetivo do sistema

Desenvolver um backend (MVP) para gestão de Ordens de Serviço (OS), permitindo:

- Controle do ciclo completo de atendimento
- Organização dos dados de clientes e veículos
- Gestão de serviços e peças
- Acompanhamento do status da OS via API

Critérios de sucesso do MVP:

- Garantir rastreabilidade de ponta a ponta do fluxo da OS (criação até entrega)
- Manter consistência das transições de status por regra de domínio
- Permitir consulta operacional de OS e cadastros com resposta estável via API

## 1.3 Escopo do MVP

- Ordens de Serviço (OS)
- Clientes
- Veículos
- Serviços
- Peças

Fora do escopo (MVP / Fase 1):

- Autenticação JWT avançada (refresh token, revogação e rotação)
- Monitoramento avançado (tempo médio e KPIs complexos)
- Controle avançado de estoque

Escopo adicionado na Fase 2 — (código):

- Persistência relacional (PostgreSQL via Prisma 7)
- API de consulta de status da OS
- Webhook de aprovação/recusa de orçamento
- Listagem ordenada de OS com filtro de status encerrados
- Notificação simulada de alteração de status (e-mail via console)

Escopo adicionado na Fase 2 — (infraestrutura):

- `Dockerfile` multi-stage otimizado com `prisma generate` e entrypoint de migration automática
- Infraestrutura como Código via Terraform (`/infra`): cluster Kind + PostgreSQL + metrics-server
- Orquestração Kubernetes (`/k8s`): Deployment, Service, ConfigMap, Secret, Job de migration, HPA (min 2 / max 5 réplicas)

Escopo adicionado na Fase 2 (automação):

- Pipeline CI/CD via GitHub Actions (`.github/workflows/ci-cd.yml`): build → lint → testes + quality gate → build/push imagem GHCR → deploy automatizado no cluster Kind com rastreabilidade por SHA

Observação de escopo: autenticação JWT foi implementada de forma simplificada no MVP (access token).

---

# 2. Requisitos

## 2.1 Requisitos Funcionais

### 2.1.1 Fluxo de OS

- **RF-OS-01: Gestão de Ordem de Serviço (ALTO IMPACTO)**
  - Funcionalidades: Criação de OS, associação com cliente e veículo, inclusão de serviços e peças, geração automática de orçamento, aprovação de orçamento, execução, finalização, entrega do veículo e consulta de OS.
  - Status da OS: RECEBIDA, EM_DIAGNOSTICO, AGUARDANDO_APROVACAO, APROVADA, EM_EXECUCAO, FINALIZADA, ENTREGUE.
  - Implementação no repositório: núcleo do domínio implementado com controle de estados.

- **RF-OS-02: Criar Ordem de Serviço**
  - Entrada: `clienteId`, `veiculoId`.
  - Validação: cliente e veículo devem existir.

- **RF-OS-03: Adicionar itens**
  - Permitido apenas em: RECEBIDA, EM_DIAGNOSTICO.
  - Tipos: `SERVICO` | `PECA`.

- **RF-OS-04: Gerar orçamento**
  - Soma automática dos itens e snapshot de preços.

- **RF-OS-05: Aprovar orçamento**
  - Altera status para `APROVADA`.

- **RF-OS-06: Iniciar execução**
  - Apenas se status = `APROVADA`.

- **RF-OS-07: Finalizar OS**
  - Apenas se status = `EM_EXECUCAO`.

- **RF-OS-08: Entregar veículo**
  - Apenas se status = `FINALIZADA`.

- **RF-OS-09: Consultar OS**
  - `GET` por id e listagem geral.

- **RF-OS-10: Consultar status da OS (Fase 2)**
  - `GET /os/:id/status` retorna `{ id, status, statusLabel }` com label em PT-BR.
  - Status possíveis: RECEBIDA, EM_DIAGNOSTICO, AGUARDANDO_APROVACAO, APROVADA, EM_EXECUCAO, FINALIZADA, ENTREGUE.

- **RF-OS-11: Webhook de aprovação/recusa de orçamento (Fase 2)**
  - `POST /os/:id/orcamento/webhook` com body `{ "aprovado": true | false }`.
  - `aprovado: true` transiciona para APROVADA; `aprovado: false` retorna para EM_DIAGNOSTICO.

- **RF-OS-12: Listagem ordenada de OS (Fase 2)**
  - `GET /os` retorna OS ativas ordenadas por prioridade operacional:
    1. EM_EXECUCAO
    2. APROVADA
    3. AGUARDANDO_APROVACAO
    4. EM_DIAGNOSTICO
    5. RECEBIDA
  - OS com status FINALIZADA e ENTREGUE são ocultadas da listagem.
  - Desempate pelo campo `criadaEm ASC` (mais antigas primeiro).

- **RF-OS-13: Notificação de alteração de status (Fase 2)**
  - A cada transição de status, um e-mail simulado é emitido via `console.log`.
  - Implementado por `ConsoleEmailNotificador` (porta `NotificadorStatus` na camada de aplicação).

### 2.1.2 Gestão administrativa

- **RF-ADM-01: Cliente**
  - Criar cliente (CPF/CNPJ), buscar cliente.

- **RF-ADM-02: Veículo**
  - Criar veículo (placa, modelo, marca, ano), buscar veículo.

- **RF-ADM-03: Peças**
  - Cadastro simples, controle básico de estoque (campo numérico).

- **RF-ADM-04: Serviços**
  - Cadastro simples.

- **RF-ADM-05: Relatórios**
  - Não implementado no MVP (fora do escopo).

## 2.2 Requisitos Não Funcionais

### 2.2.1 Arquitetura

- Monólito em camadas com DDD aplicado no domínio e Clean Architecture para separar responsabilidades.
- Camadas: Domain, Application (use-cases), Interfaces (HTTP/controllers), Infrastructure (repositórios).
- Implementação atual (Fase 2): persistência relacional com **PostgreSQL 16** via **Prisma 7** (`@prisma/adapter-pg`, driver adapter). [ADR-006](./adr/ADR-006-estrategia-persistencia-pos-mvp.md)
- Seam de repositório em `src/infraestructure/singletons.ts`: testes usam repositórios in-memory; runtime usa repositórios Prisma (swap ocorre em `main.ts` antes do `NestFactory.create`).

### 2.2.2 Segurança

- Validação de entrada: campos obrigatórios, formato de documento (CPF/CNPJ), placa e tipos de item da OS.
- Validação de regra: transições de estado e pré-condições da OS são validadas no domínio.
- Autenticação/autorização: JWT (access token) e RBAC básico implementados no MVP.
- Política de token: payload mínimo (`sub`, `role`) e expiração padrão de 1h.
- Sem refresh token no MVP: decisão intencional para reduzir complexidade inicial em ambiente controlado.
- Tratamento de erro: padronização de erros de validação e regra de negócio deve ser aplicada na camada HTTP (plano de evolução).

### 2.2.3 Performance

- Persistência relacional (PostgreSQL) com Prisma 7 e driver nativo `pg` (sem overhead de conversão de protocolo).
- Repositórios in-memory mantidos como test doubles — execução de testes sem dependência de banco.

### 2.2.4 Testes

- Testes automatizados parciais: testes de domínio e testes de fluxo principal (E2E) parcialmente implementados.

### 2.2.5 Deploy

- Aplicação containerizada com Docker (`Dockerfile` multi-stage, imagem Alpine não-root).
- `docker-compose.yml` contém dois serviços: `api` (depende de `postgres` via `service_healthy`) e `postgres` (imagem `postgres:16-alpine`).
- Migrations aplicadas automaticamente pelo `docker-entrypoint.sh` antes de iniciar a API — um único `docker-compose up --build` é suficiente.
- Infraestrutura como Código (Sprint 2): cluster Kubernetes local provisionado por Terraform (`/infra`) com Kind; manifestos de orçuestração em `/k8s` aplicados via `kubectl apply -k`.
- Pipeline CI/CD (Sprint 3): GitHub Actions com 4 jobs encadeados (`build-lint → test → docker-build → deploy`); imagem publicada no GHCR com tag por SHA; deploy automatizado no cluster Kind via Terraform + Kustomize.

---

# 3. Modelagem de Domínio (DDD)

## 3.1 Linguagem Ubíqua

O sistema utiliza uma linguagem ubíqua alinhada ao domínio de oficinas mecânicas, garantindo consistência entre código, documentação e regras de negócio.

### Termos principais

- Ordem de Serviço (OS): representa o ciclo completo de atendimento de um veículo
- Cliente: solicitante do serviço
- Veículo: objeto do atendimento
- Item da OS: componente da ordem (serviço ou peça)
- Serviço: atividade executada (ex: troca de óleo)
- Peça: insumo utilizado

### Status da Ordem de Serviço

- RECEBIDA
- EM_DIAGNOSTICO
- AGUARDANDO_APROVACAO
- APROVADA
- EM_EXECUCAO
- FINALIZADA
- ENTREGUE

### Ações do domínio

- Diagnosticar
- Gerar orçamento
- Aprovar orçamento
- Recusar orçamento (Fase 2)
- Executar serviço
- Finalizar OS
- Entregar veículo

## 3.2 Event Storming

- Fluxo Principal (extraído do contexto do projeto):
  1. Criar OS (cliente + veículo)
  2. Iniciar diagnóstico
  3. Adicionar itens
  4. Gerar orçamento
  5. Aprovar orçamento
  6. Executar
  7. Finalizar
  8. Entregar
  
![Event storming](./diagram/image/eventStorming2.png)  



## 3.3 Entidades e Agregados

O domínio foi modelado utilizando o conceito de Aggregate do Domain-Driven Design, garantindo consistência e controle das regras de negócio.

### 3.3.1 Bounded Contexts (visão atual)

- Contexto Ordem de Serviço (núcleo): concentra regras transacionais e ciclo de vida da OS.
- Contexto Cadastro: cliente e veículo como entidades referenciadas por identificador.
- Contexto Catálogo: serviços e peças usados como base para composição dos itens da OS.

Observação arquitetural: no estado atual do MVP, os contextos convivem no mesmo monólito modular. A separação é lógica (domínio e responsabilidades) e não física (serviços independentes).

### Aggregate Root

#### OrdemServico

A entidade OrdemServico é o Aggregate Root do sistema, sendo responsável por:

- Controlar o ciclo de vida da OS
- Garantir as regras de negócio
- Gerenciar os itens associados
- Controlar o status da operação

Apenas o Aggregate Root pode ser manipulado diretamente por outros componentes do sistema.

![DDD Oficina](./diagram/image/Oficina-DDD.png)  

---

### Entidades internas ao Aggregate

#### ItemOrdemServico

Representa um item dentro da Ordem de Serviço.

Pode ser de dois tipos:
- SERVICO (mão de obra)
- PECA (insumo)

Atributos:
- tipo
- descricao
- preco
- quantidade

Observação:
Os itens não existem fora do contexto da OrdemServico.

---

### Entidades externas ao Aggregate

#### Cliente (Bounded Context: Cadastro)

Representa o solicitante do serviço.

Atributos:
- id
- nome
- documento (CPF/CNPJ)

Observação:
É referenciado pela OrdemServico, mas não pertence ao aggregate.

---

#### Veiculo (Bounded Context: Cadastro)

Representa o veículo atendido.

Atributos:
- id
- placa
- marca
- modelo
- ano

Observação:
Assim como Cliente, é uma entidade externa referenciada.

---

#### Serviço (Bounded Context: Catálogo)

Define os tipos de serviços disponíveis.

---

#### Peça (Bounded Context: Catálogo)

Define os insumos disponíveis para utilização.

---

### Consistência do Aggregate

Todas as regras de negócio são garantidas dentro do Aggregate OrdemServico, incluindo:

- Controle de status
- Inclusão de itens
- Transições de estado
- Validação de fluxo

Isso garante consistência de regra de negócio no contexto do MVP e no fluxo operacional previsto.

## 3.4 Regras de Negócio

As regras de negócio foram centralizadas no Aggregate OrdemServico, garantindo consistência e previsibilidade no fluxo do sistema.

---

### Regras de criação

- Uma Ordem de Serviço só pode ser criada se:
  - Cliente existir
  - Veículo existir

---

### Regras de itens

- Itens só podem ser adicionados nos status:
  - RECEBIDA
  - EM_DIAGNOSTICO

- Ao adicionar um item:
  - O valor total da OS deve ser recalculado

---

### Regras de orçamento

- O orçamento deve ser gerado antes da aprovação
- Ao gerar orçamento:
  - Status muda para AGUARDANDO_APROVACAO

---

### Regras de aprovação

- Apenas ordens em AGUARDANDO_APROVACAO podem ser aprovadas
- Após aprovação:
  - Status muda para APROVADA

---

### Regras de execução

- Execução só pode iniciar se:
  - Status = APROVADA

- Ao iniciar execução:
  - Status muda para EM_EXECUCAO

---

### Regras de finalização

- A OS só pode ser finalizada se:
  - Status = EM_EXECUCAO

- Após finalização:
  - Status muda para FINALIZADA

---

### Regras de entrega

- A OS só pode ser entregue se:
  - Status = FINALIZADA

- Após entrega:
  - Status muda para ENTREGUE

---

### Regras de recusa de orçamento (Fase 2)

- Recusa é acionada via `POST /os/:id/orcamento/webhook` com `{ "aprovado": false }`.
- Apenas ordens em AGUARDANDO_APROVACAO podem ser recusadas.
- Após recusa:
  - Status retorna para EM_DIAGNOSTICO (reabre para novo diagnóstico e reorçamento).
  - Essa transição também dispara notificação de alteração de status.

### Regras de ajuste (fluxo alternativo)

- É possível retornar a OS para diagnóstico quando:
  - Status = AGUARDANDO_APROVACAO

- Esse fluxo permite:
  - Inclusão de novos itens
  - Regeração de orçamento

---

### Regras de integridade

- Não é permitido pular estados
- Todas as transições devem seguir o fluxo definido
- Todas as validações são realizadas dentro do Aggregate

Regras explicitamente fora do escopo desta etapa:

- Controle transacional de concorrência em nível de banco (será tratado após migração de persistência)
- Estratégia de cancelamento de OS em estados avançados (a definir em evolução de negócio)
- Reserva de estoque com lock otimista/pessimista (planejado para fase com banco relacional)

# 4. Arquitetura de Software

## 4.1 Visão Geral

- Arquitetura adotada: DDD + Clean Architecture em aplicação NestJS.
- Descrição: monolito modular com separação clara entre domínio, casos de uso, interfaces e infra.

Diagramas de arquitetura (C4) criados em plantUML como exemplificado na "Aula 3 - Modelos e Diagramas de Arquitetura: C4 Model".

- C1 (Contexto): `./diagram/C1_Oficina_Context.puml`
- C2 (Containers): `./diagram/C2_Oficina_Container.puml`
- C3 (Componentes): `./diagram/C3_Oficina_Component.puml`
- Fluxo de autenticação (sequência): `.diagram/fluxoAutenticacao.puml`

Observação: o nível C4 (código) será elaborado em etapa posterior por ser mais orientado a desenvolvedores e depender da estabilização final dos módulos internos.

## 4.2 Modelo C4

### 4.2.1 Contexto

- Sistema: Backend da Oficina (MVP) — expõe API para front-end/consumidores.
- Usuários: clientes, atendentes e mecânicos.

![C1 - Contexto](./diagram/image/C1_Oficina_Context.png)

### 4.2.2 Containers

- API (NestJS) — aplica casos de uso; endpoints REST.
- PostgreSQL 16 — banco relacional; persistência durável de todas as entidades.
- Repositórios Prisma (`src/infraestructure/repositories/prisma-*.repository.ts`) — adaptadores que implementam as interfaces de domínio usando `PrismaClient` com driver `PrismaPg`.
- Repositórios In-Memory (`src/infraestructure/in-memory-*.repository.ts`) — test doubles; usados exclusivamente nos testes unitários via seam em `singletons.ts`.
- Serviços externos (opcional): gateway de pagamentos, serviço de notificações.

![C2 - Containers](./diagram/image/C2_Oficina_Container.png)

### 4.2.3 Componentes

- Controllers (HTTP) — adaptadores de entrada: `src/interfaces/http/*`.
- Use-Cases / Application Services — `src/application/use-cases/*`.
- Ports (Application) — `src/application/ports/notificador-status.ts` (interface para notificação de status).
- Domain Entities — `src/domain/entities/*`.
- Repositories (Infra) — `src/infraestructure/repositories/prisma-*.repository.ts` (Prisma, runtime) e `src/infraestructure/in-memory-*.repository.ts` (test doubles).
- Notificador (Infra) — `src/infraestructure/notificacao/console-email-notificador.ts` (implementa `NotificadorStatus`, simula e-mail via `console.log`).
- Schema Prisma — `prisma/schema.prisma`; migrations em `prisma/migrations/`.

![C3 - Componentes](./diagram/image/C3_Oficina_Component.png)

### 4.2.4 Fluxo de autenticação JWT (sequência)

- Login via `POST /auth/login` retorna `access_token` com expiração de 1h.
- Endpoints protegidos usam `Authorization: Bearer <token>`.
- Validação ocorre com `JwtAuthGuard` + `JwtStrategy` e autorização com `RolesGuard`.

![Fluxo de Autenticacao JWT](./diagram/image/fluxoAutenticacao.png)

## 4.3 Low Level Design (LLD)

- Estrutura de código e infraestrutura (Fase 2):

```
src/
  domain/
    entities/           ← regras de negócio puras
    repositories/       ← interfaces I*Repository
  application/
    use-cases/          ← orquestração assíncrona
    ports/              ← NotificadorStatus (interface)
  interfaces/
    http/               ← controllers, DTOs, mapper de status
  infraestructure/
    in-memory-*.ts      ← test doubles (async)
    repositories/       ← prisma-*.repository.ts (runtime)
    prisma/             ← PrismaService, PrismaModule
    notificacao/        ← ConsoleEmailNotificador
    singletons.ts       ← seam de runtime vs. teste
prisma/
  schema.prisma         ← modelos e enums Prisma
  migrations/           ← migrations geradas
generated/
  prisma/client/        ← PrismaClient gerado (não versionar)
infra/                  ← Terraform (Sprint 2+)
  versions.tf           ← providers: kind, kubernetes, kubectl, helm
  main.tf               ← kind_cluster + kubernetes_namespace
  database.tf           ← Postgres no cluster (Secret, PVC, Deployment, Service)
  addons.tf             ← metrics-server via Helm (habilita HPA)
  app-k8s.tf             ← recursos K8s da app via provider kubectl (namespace, configmap, secret, migrate job, deployment, HPA)
  variables.tf, outputs.tf, terraform.tfvars.example
  manifests/             ← YAML/templates aplicados pelo app-k8s.tf
    00-namespaces/, 01-config/, 02-app/ (deployment, migrate-job, hpa, service)
docker-entrypoint.sh    ← aguarda banco, aplica migrations, inicia API
```

- Camadas e responsabilidades: Domain (regras), Application (orquestra use-cases + porta de notificação), Interfaces (adapters HTTP), Infrastructure (repositórios Prisma e in-memory, notificador, singletons).

Aderência arquitetural (Fase 2):

- Repositórios desacoplados por interfaces `I*Repository` — use cases dependem de contrato, não de implementação.
- Porta `NotificadorStatus` na camada Application; implementação `ConsoleEmailNotificador` na infra (Dependency Inversion completo).
- Seam em `singletons.ts` isola testes de banco sem uso de mocks pesados (pattern testable-by-default).
- Para produção: manter consolidação de erros de domínio → HTTP e adicionar transações Prisma nos fluxos de escrita da OS.
![Exemplo de estrutura de código](./diagram/image/lld-strucuture.png)

## 4.4 Decisões Arquiteturais (ADR)

Este projeto registra decisões arquiteturais importantes como ADRs (Architecture Decision Records). As ADRs foram organizadas em arquivos individuais no diretório `docs/adr/`.

Índice de ADRs:

- [ADR-001-ddd-modelagem-dominio.md](adr/ADR-001-ddd-modelagem-dominio.md) — modelagem inicial do domínio com DDD.
- [ADR-002-clean-architecture-camadas.md](adr/ADR-002-clean-architecture-camadas.md) — separação por camadas e responsabilidades.
- [ADR-003-persistencia-in-memory-mvp.md](adr/ADR-003-persistencia-in-memory-mvp.md) — persistência in-memory no MVP.
- [ADR-004-nestjs-backend.md](adr/ADR-004-nestjs-backend.md) — adoção de NestJS + TypeScript.
- [ADR-005-monolito-modular-mvp.md](adr/ADR-005-monolito-modular-mvp.md) — monólito modular como estratégia inicial.
- [ADR-006-estrategia-persistencia-pos-mvp.md](adr/ADR-006-estrategia-persistencia-pos-mvp.md) — estratégia de evolução de persistência.
- [ADR-007-jwt-rbac.md](adr/ADR-007-jwt-rbac.md) — JWT e RBAC no MVP.
- [ADR-008-estrategia-testes-quality-gate.md](adr/ADR-008-estrategia-testes-quality-gate.md) — estratégia de testes e quality gate.
- [ADR-009-versionamento-api.md](adr/ADR-009-versionamento-api.md) — versionamento da API.
- [ADR-010-observabilidade-minima-erros.md](adr/ADR-010-observabilidade-minima-erros.md) — observabilidade mínima e tratamento de erros.

---

## 4.5 Padrões Arquiteturais Aplicados

Esta seção documenta os padrões de design utilizados na Fase 2 com justificativa, benefícios e localização no código. Serve como referência arquitetural para evolução do projeto e para estudos de caso em projetos futuros.

---

### 4.5.1 Clean Architecture — a Regra da Dependência

**Conceito:** definido por Robert C. Martin, o princípio central é simples: dependências de código-fonte só podem apontar para dentro. As camadas mais internas não conhecem as camadas externas.

```
┌──────────────────────────────────────────────┐
│  Infraestrutura  (Prisma, HTTP, console.log) │  depende de tudo
│  ┌────────────────────────────────────────┐  │
│  │  Application  (use-cases, ports)       │  │  depende só do domínio
│  │  ┌──────────────────────────────────┐  │  │
│  │  │  Domínio  (entidades, interfaces) │  │  │  não depende de nada
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Por que usamos:** garante que uma mudança de banco de dados, de framework HTTP ou de provedor de e-mail não exija alterações nas regras de negócio. O domínio é o ativo mais valioso do sistema e deve ser protegido de volatilidade tecnológica.

**Como se manifesta no código:** `OrdemServico` não faz nenhum `import` de NestJS, Prisma ou qualquer biblioteca externa. Ela só conhece TypeScript puro.

**Ganho mensurável:** durante a migração de in-memory para Prisma, nenhuma linha do domínio precisou mudar.

---

### 4.5.2 Repository Pattern + Dependency Inversion Principle (DIP)

**Conceito:** o domínio define *contratos* (interfaces) para persistência. A infraestrutura *cumpre* esses contratos com implementações concretas. Quem define a regra é quem está dentro; quem implementa o mecanismo é quem está fora.

**Estrutura:**
```
src/domain/repositories/i-ordem-servico.repository.ts  ← contrato (domínio)
src/infraestructure/repositories/prisma-ordem-servico.repository.ts  ← implementação real
src/infraestructure/in-memory-ordem-servico.repository.ts  ← implementação de teste
```

**Interface:**
```typescript
interface IOrdemServicoRepository {
  getById(id: string): Promise<OrdemServico | null>;
  save(os: OrdemServico): Promise<void>;
  all(): Promise<OrdemServico[]>;
}
```

**Use case — não sabe quem implementa:**
```typescript
class CriarOrdemServico {
  constructor(private repo: IOrdemServicoRepository) {}
  async execute(): Promise<OrdemServico> {
    const os = OrdemServico.criar(...);
    await this.repo.save(os);   // fala com o contrato
    return os;
  }
}
```

**Por que usamos:** o DIP (letra D do SOLID) inverte a direção da dependência. Sem ele, o use case dependeria de `PrismaOrdemServicoRepository` diretamente — trocar o banco exigiria editar a regra de negócio.

**Ganho:** ao longo da Fase 2, adicionamos PostgreSQL sem editar nenhum use case. A troca foi feita somente no wiring (singletons).

---

### 4.5.3 Seam Pattern — testabilidade sem mock pesado

**Conceito:** um "seam" (costura) é um ponto no código onde é possível alterar o comportamento sem modificar o código em si. O termo vem do livro *Working Effectively with Legacy Code* (Michael Feathers). Ele é especialmente útil quando não há um framework de DI disponível ou quando se quer evitar o overhead de mocks.

**Implementação em `singletons.ts`:**
```typescript
// estado padrão — usado pelos testes (main.ts nunca roda em teste)
export let ordemRepo: IOrdemServicoRepository = new InMemoryOrdemServicoRepository();

// chamado por main.ts antes de NestFactory.create — substitui em runtime
export function useDatabaseRepositories(prisma: PrismaService) {
  ordemRepo = new PrismaOrdemServicoRepository(prisma);
}
```

**Fluxo em runtime:**
```
main.ts → conecta Prisma → useDatabaseRepositories(prisma) → NestFactory.create
                                    ↑
                       singletons agora apontam para Prisma
                       controllers capturam esses valores na construção
```

**Fluxo em teste:**
```
spec.ts importa controller → controller usa ordemRepo (in-memory)
                                             ↑
                               main.ts nunca rodou → segue in-memory
```

**Por que usamos:** mantemos a estrutura de controllers auto-instanciados da Fase 1 (sem converter para providers do Nest), preservando o design avaliado pela banca. O seam dá o mesmo benefício de DI sem mudar a estrutura.

**Trade-off registrado:** o seam usa variáveis exportadas mutáveis, o que seria problemático com múltiplas instâncias paralelas. Para o escopo do projeto (processo único) é aceitável. Em escala, o caminho é migrar para DI pleno do Nest.

---

### 4.5.4 Ports & Adapters (Arquitetura Hexagonal)

**Conceito:** proposto por Alistair Cockburn, o padrão separa o núcleo da aplicação de seus "drivers" (quem ativa o sistema) e "driven adapters" (a quem o sistema chama). As *portas* são interfaces na borda da aplicação; os *adapters* são implementações externas conectadas a essas portas.

**Porta (Application Layer):**
```typescript
// src/application/ports/notificador-status.ts
interface NotificadorStatus {
  notificar(ordem: OrdemServico, statusAnterior: StatusOrdemServico): Promise<void> | void;
}
```

**Adapter (Infrastructure Layer):**
```typescript
// src/infraestructure/notificacao/console-email-notificador.ts
class ConsoleEmailNotificador implements NotificadorStatus {
  notificar(ordem: OrdemServico, statusAnterior: StatusOrdemServico): void {
    if (statusAnterior === ordem.getStatus()) return;
    console.log(`[EMAIL] OS ${ordem.id} — status: ${statusAnterior} → ${ordem.getStatus()}`);
  }
}
```

**Use case — depende da porta, não do adapter:**
```typescript
class AprovarOrcamento {
  constructor(
    private repo: IOrdemServicoRepository,
    private notificador: NotificadorStatus,
  ) {}
  async execute(id: string): Promise<void> {
    const os = await this.repo.getById(id);
    const statusAnterior = os.getStatus();
    os.aprovarOrcamento();
    await this.repo.save(os);
    this.notificador.notificar(os, statusAnterior);  // fala com a porta
  }
}
```

**Por que usamos:** trocar de `console.log` para Nodemailer, SendGrid ou uma fila SQS requer apenas um novo adapter — zero mudanças no domínio ou nos use cases.

**Ganho de testabilidade:** nos testes de use case, o notificador pode ser um objeto vazio `{ notificar: () => {} }` passado como argumento. Sem acoplamento, sem `jest.mock`.

---

### 4.5.5 Driver Adapter Pattern — Prisma 7

**Contexto:** o Prisma 7 introduziu uma mudança arquitetural relevante. Versões anteriores se conectavam ao banco via string de conexão embutida no `schema.prisma`. No Prisma 7, a conexão é encapsulada num **driver adapter** — um objeto passado ao construtor do `PrismaClient`.

**Implementação:**
```typescript
// PrismaService — infraestrutura
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });
```

**Por que essa mudança existe:** o Prisma 7 foi projetado para rodar em ambientes *edge* (Cloudflare Workers, Deno, Bun) onde o acesso a TCP é restrito. O driver adapter abstrai o protocolo de transporte, desacoplando o ORM do mecanismo de conexão — aplicando o mesmo DIP internamente.

**Impacto no projeto:** sem o adapter, o `PrismaClient` no Prisma 7 rejeita o construtor vazio — o TypeScript lança erro de compilação. Identificamos isso via `tsc --noEmit` durante o ciclo de quality gate.

**Para projetos futuros:** ao usar Prisma 7+, sempre instanciar o adapter explicitamente e passar via `super({ adapter })` caso `PrismaService` estenda `PrismaClient`.

---

### 4.5.6 Contratos assíncronos — por que as interfaces retornam `Promise<T>`

**Conceito:** uma interface de repositório deve refletir a *natureza real* da operação que ela abstrai. Operações de I/O (banco, rede, disco) são assíncronas por natureza. Se a interface retorna o tipo direto (`OrdemServico`), ela mente — força a implementação a ser síncrona, o que é impossível com banco de dados real.

**Interface correta:**
```typescript
interface IOrdemServicoRepository {
  getById(id: string): Promise<OrdemServico | null>;  // honesta: pode levar tempo
}
```

**Propagação obrigatória:** ao tornar o contrato assíncrono, toda a cadeia que consome esse contrato precisa usar `await`. Isso é chamado de *async propagation* — ela sobe pela pilha de chamadas até o ponto de entrada (controller).

```
controller.criar()  →  await criarOS.execute()  →  await repo.save(os)
     ↑ async               ↑ async                     ↑ I/O real
```

**Por que não usar callbacks ou eventos:** `Promise` com `async/await` é o padrão idiomático do TypeScript moderno. Mantém o fluxo legível (top-down, sem "callback hell"), integra nativamente com `try/catch` para tratamento de erro, e é o modelo que o NestJS, Prisma e todas as libs modernas adotam.

**Para projetos futuros:** definir interfaces de repositório como `Promise<T>` desde o início, mesmo usando in-memory. Isso evita o retrabalho de propagação assíncrona na hora de migrar para banco real.

---

# 5. API

## 5.1 Endpoints

Endpoints mapeados a partir dos controllers da aplicação (prefixos reais de rota):

### Ordem de Serviço (`/os`)

- `POST /os`
  - Descrição: cria uma OS.
  - Request (exemplo):
    ```json
    {
      "clienteId": "uuid-opcional",
      "veiculoId": "uuid-opcional"
    }
    ```
  - Respostas:
    - `200`: OS criada.
    - `400`: `clienteId`/`veiculoId` inválidos.

- `POST /os/:id/diagnostico`

- `POST /os/:id/item`
  - Descrição: adiciona item (serviço/peça) à OS.
  - Request (exemplo):
    ```json
    {
      "tipo": "SERVICO",
      "idReferencia": "uuid-servico-ou-peca",
      "quantidade": 1
    }
    ```
  - Respostas:
    - `200`: item adicionado.
    - `404`: OS não encontrada.
    - `400`: violação de regra de domínio.

- `POST /os/:id/orcamento`
- `POST /os/:id/enviar-orcamento`
- `POST /os/:id/aprovar`
- `POST /os/:id/executar`
- `POST /os/:id/finalizar`
- `POST /os/:id/entregar`

- `GET /os/:id/status` **(Fase 2)**
  - Descrição: retorna status atual da OS com label em PT-BR.
  - Respostas:
    - `200`: `{ "id": "...", "status": "EM_EXECUCAO", "statusLabel": "Em Execução" }`
    - `404`: OS não encontrada.

- `POST /os/:id/orcamento/webhook` **(Fase 2)**
  - Descrição: notificação externa de decisão do cliente sobre o orçamento.
  - Request: `{ "aprovado": true }` ou `{ "aprovado": false }`
  - Respostas:
    - `200`: transição aplicada.
    - `400`: status incorreto para aprovação/recusa.
    - `404`: OS não encontrada.

- `GET /os/:id`
  - Descrição: consulta OS por identificador.
  - Respostas: `200`/`404`.

- `GET /os`
  - Descrição: lista OS ativas ordenadas por prioridade operacional (EM_EXECUCAO > APROVADA > AGUARDANDO_APROVACAO > EM_DIAGNOSTICO > RECEBIDA). OS com status FINALIZADA/ENTREGUE são omitidas.

- `GET /os/sla-atendimento`
  - Descrição: métrica de SLA médio (criação -> finalização), considerando apenas OS em status `FINALIZADA`.
  - Respostas comuns:
    - `200`: métrica calculada.

### Clientes (`/clientes`)

- `POST /clientes`
  - Request: `{ "nome": "...", "documento": "..." }`
  - Respostas: `200`/`400`.

- `GET /clientes/:id`
  - Respostas: `200`/`404`.

- `GET /clientes`

### Veículos (`/veiculos`)

- `POST /veiculos`
  - Request: `{ "placa": "...", "modelo": "...", "marca": "...", "ano": 2024 }`
  - Respostas: `200`/`400`.

- `GET /veiculos/:id`
- `GET /veiculos`

### Serviços (`/servicos`)

- `POST /servicos`
  - Request: `{ "nome": "...", "preco": 120.0 }`
  - Respostas: `200`/`400`.

- `GET /servicos/:id`
- `GET /servicos`

### Peças (`/pecas`)

- `POST /pecas`
  - Request: `{ "nome": "...", "preco": 50.0, "estoque": 10 }`
  - Respostas: `200`/`400`.

- `PATCH /pecas/:id/estoque`
  - Request: `{ "delta": -1 }`
  - Respostas: `200`/`400`.

- `GET /pecas/:id`
- `GET /pecas`

Padronização de erro (estado atual):

- Exceções de validação e regra de domínio são mapeadas principalmente para `400`.
- Recursos inexistentes são mapeados para `404`.
- A padronização de envelope de erro ficará na evolução do ADR-010.

## 5.2 Swagger / OpenAPI

Implementação concluída:

- Dependências instaladas:
  - `@nestjs/swagger`
  - `swagger-ui-express`
- Bootstrap configurado em `src/main.ts` com `DocumentBuilder` e `SwaggerModule`.
- Endpoints publicados:
  - UI interativa: `/docs`
  - JSON OpenAPI: `/docs-json`

Como validar funcionamento:

1. Subir a aplicação:
  ```bash
  npm run start:dev
  ```
2. Abrir a UI do Swagger no navegador:
  - `http://localhost:3000/docs`
3. Validar se o JSON OpenAPI está acessível:
  - `http://localhost:3000/docs-json`
4. Confirmar que os controllers principais aparecem na documentação:
  - `/os`, `/clientes`, `/veiculos`, `/servicos`, `/pecas`

Ordem recomendada para demo (fluxo lógico da OS):

1. `POST /auth/login` (obter token JWT).
2. Preparação de dados (ATENDENTE/ADMIN):
  - `POST /clientes`
  - `POST /veiculos`
  - `POST /servicos`
  - `POST /pecas`
3. Início da OS (ATENDENTE):
  - `POST /os`
4. Diagnóstico (MECANICO):
  - `POST /os/:id/diagnostico`
5. Adição de itens (ATENDENTE):
  - `POST /os/:id/item`
6. Orçamento e envio (ATENDENTE):
  - `POST /os/:id/orcamento`
  - `POST /os/:id/enviar-orcamento`
7. Aprovação (ATENDENTE):
  - `POST /os/:id/aprovar`
8. Execução (MECANICO):
  - `POST /os/:id/executar`
9. Finalização (MECANICO):
  - `POST /os/:id/finalizar`
10. Métricas (público):
  - `GET /os/sla-atendimento`
11. Entrega (ATENDENTE):
  - `POST /os/:id/entregar`
12. Consultas (público):
  - `GET /os/:id`, `GET /os`

Checklist rápido da demo (para apresentação):

- Subir a API e abrir `/docs`.
- Autenticar via `POST /auth/login` e preencher o Bearer token no Swagger.
- Criar dados mínimos (cliente, veículo, serviço e peça).
  - Opcional: habilite `SEED_DATA=true` no `.env` para pré-carregar dados de demo e pular esta etapa.
  - IDs seed (fixos): cliente `cli-001`, veículo `vei-001`, serviço `srv-001`, peça `pec-001`.
- Criar OS e seguir o fluxo completo até `ENTREGUE`.
- Demonstrar validação de regra: tentar pular um estado e mostrar o erro.
- Encerrar mostrando consulta da OS e métrica de SLA de atendimento.

Observações importantes:

- Os endpoints já utilizam DTOs específicos para request body, com propriedades documentadas via `@ApiProperty`.
- Controllers principais estão decorados com `@ApiTags`, `@ApiOperation`, `@ApiBody` e `@ApiResponse` para melhorar descrição de operações e respostas.
- Evolução recomendada: adotar validação automática com `class-validator` + `ValidationPipe` e enriquecer schemas de resposta tipando DTOs de saída.

---

# 6. Segurança

Estado atual (MVP):

- Autenticação JWT ativa no endpoint `POST /auth/login` e nos endpoints administrativos protegidos.
- Autorização RBAC básica por perfil (`ADMIN`, `MECANICO`, `ATENDENTE`) aplicada na camada HTTP com guards.
- Validação de entrada implementada de forma pontual nos controllers/use-cases.
- Persistência em memória (sem dados sensíveis persistidos em disco pela aplicação).

## 6.1 Validações de entrada (CPF/CNPJ e Placa)

Validações implementadas no MVP (camada HTTP), focadas em evitar dados inválidos na entrada do sistema:

- Documento (Cliente): aceita CPF (11 dígitos) e CNPJ (14 dígitos), validando tamanho e formato numérico.
- Placa (Veículo): valida padrões de placa antiga e Mercosul, normalizando para maiúsculas (quando aplicável).

Observação: além dessas validações, transições de status e pré-condições do fluxo de OS são validadas por regras de domínio.

Fluxo de autenticação implementado:

1. Cliente envia `email` e `senha` para `POST /auth/login`.
2. A API valida o usuário mock in-memory do MVP.
3. A API retorna `{ access_token }` JWT com claims mínimas (`sub`, `role`) e expiração de 1h.
4. Em endpoints protegidos, o cliente envia `Authorization: Bearer <token>`.

Matriz RBAC implementada no fluxo de OS:

- `POST /os`, `POST /os/:id/item`, `POST /os/:id/orcamento`, `POST /os/:id/aprovar`, `POST /os/:id/entregar` → `ATENDENTE`
- `POST /os/:id/diagnostico`, `POST /os/:id/executar`, `POST /os/:id/finalizar` → `MECANICO`
- `ADMIN` → acesso total aos endpoints protegidos.

Endpoints públicos no MVP:

- `GET /os` e `GET /os/:id` permanecem públicos, pois o MVP assume ambiente controlado para validação rápida do fluxo operacional.

Estratégia alvo (pós-MVP):

- Autenticação: evoluir para JWT com access token + refresh token.
- Autorização: RBAC por perfil operacional.
- Hardening de API:
  - CORS restrito por ambiente.
  - Rate limiting por IP/cliente.
  - Segredos via variáveis de ambiente e cofre/CI.
  - Uso obrigatório de HTTPS em ambientes não-locais.

Checklist de segurança para entrega técnica:

- [ ] Definir claims e tempo de expiração de tokens.
- [ ] Definir matriz de permissões por endpoint.
- [ ] Definir política de rotação de secrets.
- [ ] Padronizar resposta de erro sem vazamento de detalhes internos.

---

# 7. Testes

### 7.1 Estratégia — Pirâmide de Testes

A pirâmide de testes (Mike Cohn) orienta a distribuição de esforço por custo e velocidade de feedback:

```
         /\
        /  \   E2E (lentos, poucos)
       /----\
      /      \  Integração (médios)
     /--------\
    /          \  Unitários (rápidos, muitos)  ← base desta estratégia
   /────────────\
```

**Por que a base é unitária:** testes unitários rodam em ~5s, sem banco, sem rede, sem Docker. Eles validam as regras de negócio isoladas — que é exatamente o que a banca avalia como "lógica crítica". E2E e integração são mais lentos e frágeis; usados para validar contratos HTTP, não regras internas.

**Testes unitários sem banco:** o Seam Pattern (§4.5.3) permite que todos os 102 testes unitários rodem contra repositórios in-memory. Nenhum teste unitário depende do PostgreSQL. Isso é chamado de *test isolation* — cada teste cobre exatamente uma coisa, sem efeitos colaterais externos.

### 7.2 Isolamento do Prisma no Jest — `moduleNameMapper`

**Problema:** o Prisma 7 gera um `client.ts` com `import.meta.url` (sintaxe ESM). O Jest executa em modo CommonJS (CJS). São incompatíveis — o Jest lançaria `SyntaxError: Cannot use 'import.meta' outside a module` ao importar qualquer arquivo que transite pelo Prisma.

**Solução — `moduleNameMapper`:** o Jest permite mapear qualquer caminho de import para um arquivo alternativo. Criamos mocks de `PrismaClient` e `PrismaPg` em `__mocks__/`:

```json
// package.json — configuração Jest
"moduleNameMapper": {
  ".*/generated/prisma/client$": "<rootDir>/../__mocks__/prisma-client.mock.ts",
  "@prisma/adapter-pg": "<rootDir>/../__mocks__/prisma-adapter-pg.mock.ts"
}
```

```typescript
// __mocks__/prisma-client.mock.ts — substituto para os testes
export class PrismaClient {
  constructor(_options?: unknown) {}
  $connect = jest.fn().mockResolvedValue(undefined);
  ordemServico = { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() };
  // ...
}
```

**O que isso resolve:** qualquer import que transite pelo Prisma gerado recebe o mock, sem precisar de `jest.mock(...)` em cada arquivo de teste. Os testes de controller continuam testando a lógica real dos controllers — apenas o cliente Prisma é substituído.

**Para projetos futuros:** sempre que usar um ORM com geração de código (Prisma, TypeORM com entities geradas), configure `moduleNameMapper` para isolar o código gerado dos testes unitários. Geração de código ESM em ambiente Jest CJS é um anti-padrão que `moduleNameMapper` resolve sem sacrificar a velocidade dos testes.

### 7.3 Gate de Cobertura Crítica

**Por que ter um gate:** cobertura sem gate é decoração. O gate (`jest.critical.config.js`) torna a cobertura um requisito do build — o CI falha se a cobertura cair abaixo de 80% nas camadas críticas.

**Escopo do gate (deliberadamente restrito):**
```javascript
collectCoverageFrom: ['domain/entities/**/*.ts', 'application/use-cases/**/*.ts']
```

Inclui apenas domínio e use cases — onde vivem as regras de negócio. Controllers, repositórios e infraestrutura não entram no gate crítico porque dependem de I/O e são testados por outros meios (E2E, integração).

**Limiar e resultado atual:**

| Métrica | Limiar | Resultado Fase 2 |
|---|---|---|
| Statements | ≥ 80% | 98.29% |
| Branches | ≥ 80% | 91.89% |
| Functions | ≥ 80% | 100% |
| Lines | ≥ 80% | 99.62% |

**Para projetos futuros:** separar o gate crítico (domínio + use cases) do gate global (projeto todo). O gate global tende a ser mais baixo e menos significativo; o gate crítico protege o que realmente importa.

Estratégia adotada:

- Unit tests: regras de domínio e casos de uso.
- E2E tests: fluxos HTTP críticos.
- Integração: parcialmente coberta pelos testes E2E devido à persistência in-memory.

Justificativa do método:

- Pirâmide de testes aplicada para reduzir custo de manutenção e aumentar velocidade de feedback.
- Regras críticas de negócio ficam protegidas por testes unitários de domínio (entidades) e de aplicação (use-cases).
- Fluxos HTTP ponta a ponta permanecem validados por E2E, garantindo contrato funcional mínimo.

Artefatos atuais:

- `test/app.e2e-spec.ts`
- `test/workflow.e2e-spec.ts`
- `src/domain/entities/*.spec.ts` (ciclo da OS, itens, estoque e entidades de cadastro)
- `src/application/use-cases/*.spec.ts` (fluxo crítico da OS, busca, cadastro e listagem)

Comandos oficiais (package.json):

- `npm run test`
- `npm run test:watch`
- `npm run test:cov`
- `npm run test:cov:critical`
- `npm run test:e2e`

Ferramentas:

- Jest
- Supertest

Meta e quality gate sugeridos para evolução:

- Cobertura mínima: `>= 80%` em domínio + use-cases.
- Gate de CI:
  - build
  - lint
  - test
  - test:e2e

Automação implementada no repositório:

- Workflow de CI em `.github/workflows/ci.yml` executando build, lint, unit, e2e e cobertura crítica.
- Threshold obrigatório de cobertura crítica definido em `jest.critical.config.js` com mínimo de `80%` para statements, branches, functions e lines.

Resultado atual — Fase 2 (escopo crítico medido com `test:cov:critical`):

- Statements: `98.29%`
- Branches: `91.89%`
- Functions: `100%`
- Lines: `99.62%`
- Total de testes: **102** (26 suites)

Conclusão: requisito de cobertura mínima `>= 80%` para domínios críticos atendido.

Matriz mínima de cenários críticos:

- Criação de OS com referência válida/inválida de cliente/veículo.
- Transições válidas e inválidas de status.
- Geração/aprovação de orçamento.
- Ajuste de estoque de peça com delta positivo/negativo.
- Busca de recursos inexistentes (`404`).

---

# 8. Infraestrutura

## 8.1 Dockerfile (Sprint 2 — multi-stage otimizado)

O `Dockerfile` foi reescrito na Sprint 2 para corrigir dois problemas críticos e otimizar a imagem de produção:

**Problemas corrigidos:**
- Stage `build` agora executa `npx prisma generate` antes de `nest build` — o client gerado (`generated/prisma/`) estava ausente na build por ser gitignored.
- Removido `COPY .env` do stage runtime — o `.env` não existe em CI e nunca deve estar em imagem de produção; variáveis chegam via `docker-compose.yml` ou Secrets do K8s.

**Otimizações:**
- Multi-stage: stage `build` (compilação completa) → stage `runtime` (`npm ci --omit=dev`); imagem final ~60% menor.
- Usuário não-root (`appuser`) no stage runtime — princípio de menor privilégio.
- `generated/prisma` copiado explicitamente do stage `build` para o `runtime`.
- Entrypoint via `docker-entrypoint.sh` em vez de `CMD` direto.

```
Stage build:  node:20-alpine → npm ci → prisma generate → nest build
Stage runtime: node:20-alpine → npm ci --omit=dev → copia dist + generated/prisma + prisma/
               → docker-entrypoint.sh → USER appuser → EXPOSE 3000
```

## 8.2 docker-entrypoint.sh

Script de inicialização que garante migrations antes do start:

```sh
#!/bin/sh
until npx prisma migrate deploy; do sleep 2; done
exec node dist/main.js
```

- Aguarda o banco com retry (até 30 tentativas, 2s entre elas).
- `prisma migrate deploy` é idempotente — sem risco de reaplicar migrations já aplicadas.
- `exec` substitui o processo shell pelo Node (PID 1), garantindo que SIGTERM chegue corretamente à API.

## 8.3 docker-compose (um comando)

Serviços: `postgres` (healthcheck via `pg_isready`) e `api` (`depends_on: service_healthy`).

```bash
# Subir API + Banco com migrations automáticas (um comando)
docker-compose up --build
```

O entrypoint cuida das migrations — nenhum passo manual necessário.

## 8.4 Terraform — Infraestrutura como Código (`/infra`)

Provisiona o cluster Kubernetes local e os recursos de banco de forma declarativa e reprodutível.

**Recursos criados:**

| Recurso | Descrição |
|---------|-----------|
| `kind_cluster` | Cluster Kind (1 control-plane + 2 workers); porta 30080 → host:3000 |
| `kubernetes_namespace` | Namespace `oficina` |
| `kubernetes_secret` (postgres) | Credenciais do Postgres (sensíveis, nunca em texto puro) |
| `kubernetes_persistent_volume_claim` | PVC de 1 GiB para dados do Postgres |
| `kubernetes_deployment` (postgres) | Pod `postgres:16-alpine` com readiness probe |
| `kubernetes_service` (postgres) | ClusterIP — DNS: `postgres.oficina.svc.cluster.local:5432` |
| `helm_release` (metrics-server) | metrics-server em `kube-system` — **obrigatório para o HPA** |

**Execução:**

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars  # ajustar db_password
terraform init
terraform plan
terraform apply
terraform destroy  # derruba tudo (cluster + dados)
```

## 8.5 Kubernetes — Orquestração via Terraform (`infra/manifests/`)

Os manifestos da aplicação são gerenciados pelo Terraform como recursos nativos do provider `gavinbunney/kubectl` (tipo `kubectl_manifest`). Não existe `kubectl apply` manual no pipeline — o Terraform é a única fonte de verdade sobre o estado do cluster.

**Estrutura dos manifestos:**

```
infra/manifests/
├── 00-namespaces/
│     └── namespace.yaml
├── 01-config/
│     ├── configmap.yaml
│     └── secret.tpl.yaml       ← templatefile: DATABASE_URL, JWT_SECRET, EXTERNAL_WEBHOOK_TOKEN
└── 02-app/
      ├── service-clusterip.yaml
      ├── service-nodeport.yaml
      ├── migrate-job.tpl.yaml  ← templatefile: image_tag, image_registry, image_pull_policy
      ├── deployment.tpl.yaml   ← templatefile: image_tag, image_registry, image_pull_policy
      └── hpa.yaml
```

**Cadeia de dependência (`depends_on` explícito no Terraform):**

```
namespace
  └─► configmap
  └─► api_secret    (templatefile — credenciais injetadas pelo Terraform)
  └─► api_service_clusterip
  └─► api_service_nodeport
        └─► migrate_job    (templatefile — image_tag do commit)
              └─► api_deployment
                    └─► api_hpa
```

**Fluxo de comunicação no cluster:**

```
Cliente HTTP
   │  (NodePort 30080 → host:3000)
   ▼
Service NodePort ──► Service ClusterIP (oficina-api)
                          │  load-balance
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Pod API #1        Pod API #2   …   Pod API #N   (2–5 réplicas — HPA)
        │   envFrom: ConfigMap (PORT/SEED) + Secret (DATABASE_URL/JWT/tokens)
        └──────► Service ClusterIP "postgres" ──► Pod PostgreSQL ──► PVC
HPA ◄── metrics-server (CPU/mem dos Pods) ──► ajusta réplicas (target CPU 60%)
Job prisma-migrate ──► Postgres (prisma migrate deploy — antes do rollout)
```

**Segredos e não-segredos:**

| Tipo | Conteúdo | Como é criado |
|------|----------|---------------|
| ConfigMap | PORT, NODE_ENV, SEED_DATA, DB_HOST/PORT/NAME | `kubectl_manifest` (versionado em `infra/manifests/01-config/`) |
| Secret | DATABASE_URL, JWT_SECRET, EXTERNAL_WEBHOOK_TOKEN | `kubectl_manifest` via `templatefile()` — valores chegam pelos `TF_VAR_*` do CI ou do `terraform.tfvars` local |

**HPA configurado:**

```yaml
minReplicas: 2
maxReplicas: 5
metrics:
  - cpu: averageUtilization 60%
  - memory: averageUtilization 70%
```

**Deploy local (Terraform puro):**

```bash
cd infra
terraform apply -target=kind_cluster.oficina -auto-approve
kind export kubeconfig --name oficina
cd .. && docker build -t oficina-api:local . && kind load docker-image oficina-api:local --name oficina
cd infra && terraform apply -var="image_tag=local" -auto-approve
kubectl wait --for=condition=complete job/prisma-migrate -n oficina --timeout=300s
kubectl rollout status deployment/oficina-api -n oficina
kubectl get pods,hpa -n oficina
```

## 8.6 Execução local (sem K8s)

```bash
# 1. Copiar variáveis de ambiente
cp .env.example .env

# 2. Instalar dependências
npm install

# 3. Subir banco + API (migrations automáticas via entrypoint)
docker-compose up --build
```

Para desenvolvimento com hot-reload:

```bash
docker-compose up -d postgres     # só o banco
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

## 8.7 CI/CD — Pipeline GitHub Actions (Sprint 3)

O arquivo `.github/workflows/ci-cd.yml` define a esteira completa de integração e entrega contínua.

### Gatilhos

| Evento | Gatilho | Jobs executados |
|--------|---------|----------------|
| `push` → `main` | automático | todos (build → test → docker → deploy) |
| `pull_request` → `main` | automático | build + test + docker-build (sem push e sem deploy) |
| `workflow_dispatch` | manual | todos (útil para gravar demo do vídeo) |

### Jobs encadeados (`needs:`)

```
build-lint ──► test ──► docker-build ──► deploy
                                          │
                                   (if: não-PR, só main)
```

Cada job só inicia se o anterior passar inteiro. Uma falha de lint, teste ou build impede que qualquer imagem seja publicada ou qualquer deploy seja feito.

### Job 1 — `build-lint`

- `npm ci` → `npx prisma generate` → `npm run build` → `npm run lint`
- Node 20 (alinhado ao `node:20-alpine` do Dockerfile de produção)
- Publica artefato `dist/` para reuso

### Job 2 — `test` (Quality Gate)

- `npm run test` (unit) + `npm run test:e2e` + `npm run test:cov:critical` (**≥ 80% cobertura crítica**)
- Testes não precisam de Postgres — o Jest usa `moduleNameMapper` para mockar o Prisma client
- Um único falso negativo de cobertura bloqueia todo o pipeline downstream

### Job 3 — `docker-build`

- Build da imagem multi-stage a partir do `Dockerfile` já otimizado (Sprint 2)
- Push para **GHCR** (`ghcr.io/<owner>/<repo>`) autenticado via `GITHUB_TOKEN` (automático, sem secret extra)
- Tags geradas: `:sha-<7chars>` (rastreabilidade) + `:latest` (apenas em push na `main`)
- Em PRs: build executado, push não realizado (valida o Dockerfile sem publicar)
- Cache de camadas via `cache-from/cache-to: type=gha` — builds subsequentes até 5× mais rápidos

### Job 4+5 — `deploy` (mesmo runner)

**Por que em um runner único:** o cluster Kind (Kubernetes em Docker) é criado nos containers do runner. Jobs separados no GitHub Actions rodam em VMs distintas e independentes — o cluster criado no "Job 4" não existiria mais no "Job 5". Consolidar em etapas sequenciais dentro de um único job é o padrão correto para clusters efêmeros.

**Etapa 4 — Infraestrutura (Terraform fase 1):**
1. Instala Kind CLI (não pré-instalado no runner)
2. `terraform init && terraform apply -target=kind_cluster.oficina -auto-approve` — cria apenas o cluster Kind
3. `kind export kubeconfig --name oficina` — aponta kubectl para o cluster recém-criado

**Etapa 5 — Carga da imagem:**
4. Login no GHCR com `GITHUB_TOKEN`
5. `docker pull ghcr.io/.../oficina-api:sha-<sha>` — baixa a imagem publicada pelo Job 3
6. `docker tag` + `kind load docker-image oficina-api:<sha>` — carrega no registry interno do Kind (necessário por `imagePullPolicy: Never`)

**Etapa 6 — Deploy declarativo (Terraform fase 2):**
7. `terraform apply -auto-approve` com `TF_VAR_image_tag=<sha>` — aplica **todos** os recursos K8s via `kubectl_manifest`:
   namespace → configmap/secret → services → migrate_job → api_deployment → api_hpa
   O `templatefile()` injeta a tag SHA no manifesto do Deployment; nenhum `kubectl apply` é executado
8. `kubectl wait --for=condition=complete job/prisma-migrate -n oficina --timeout=300s` — aguarda migration
9. `kubectl rollout status deployment/oficina-api -n oficina` — confirma Pods Running
10. `kubectl get hpa -n oficina` — verifica autoescala configurada (min 2 / max 5)
11. `curl http://localhost:3000/docs` — smoke test via NodePort mapeado pelo Kind

### Arquitetura IaC declarativa — `kubectl_manifest` (padrão adotado)

O Terraform gerencia **todos** os recursos Kubernetes como recursos nativos do provider `gavinbunney/kubectl`, organizados em três camadas com `depends_on` explícito:

```
infra/manifests/
├── 00-namespaces/    → kubectl_manifest.namespace
│     namespace.yaml
├── 01-config/        → kubectl_manifest.configmap
│     configmap.yaml  → kubectl_manifest.api_secret (templatefile — valores sensíveis via TF_VAR_*)
│     secret.tpl.yaml
└── 02-app/           → kubectl_manifest.api_service_clusterip / api_service_nodeport
      service-clusterip.yaml  → kubectl_manifest.migrate_job (templatefile — image_tag, image_registry)
      service-nodeport.yaml   → kubectl_manifest.api_deployment (templatefile — image_tag, image_registry)
      migrate-job.tpl.yaml    → kubectl_manifest.api_hpa
      deployment.tpl.yaml
      hpa.yaml
```

Cadeia de dependência garantida por `depends_on`:
`namespace → (configmap, secret, services) → migrate_job → api_deployment → api_hpa`

Nenhuma chamada a `kubectl` CLI para criação de recursos dentro do HCL. Nenhum `null_resource` com `local-exec`. O `templatefile()` injeta variáveis sensíveis (`jwt_secret`, `external_webhook_token`, `image_tag`) no momento do `terraform apply`, protegendo-as com `sensitive_fields`. Os únicos comandos `kubectl` no pipeline são verificações de estado (`kubectl wait`, `kubectl rollout status`, `kubectl get hpa`) — não criam nem modificam recursos.

### Secrets obrigatórios (GitHub Settings → Secrets → Actions)

| Secret | Injetado como |
|--------|--------------|
| `DB_PASSWORD` | `TF_VAR_db_password` → Postgres + `DATABASE_URL` no Secret K8s |
| `JWT_SECRET` | `TF_VAR_jwt_secret` → Secret `oficina-api-secrets` via `templatefile()` |
| `EXTERNAL_WEBHOOK_TOKEN` | `TF_VAR_external_webhook_token` → Secret `oficina-api-secrets` via `templatefile()` |

`GITHUB_TOKEN` é provido automaticamente pelo GitHub Actions — nenhuma configuração necessária para autenticação no GHCR.

### Rastreabilidade SHA → imagem → cluster

```
git commit abc1234
    │
    ▼ push main
Job docker-build → ghcr.io/.../oficina-api:sha-abc1234
    │
    ▼ Job deploy
kind load docker-image → Kind encontra a imagem localmente
terraform apply → templatefile() injeta image_tag=abc1234 no manifesto do Deployment
kubectl_manifest.api_deployment → Pods sobem com a imagem do commit abc1234
```

Qualquer Pod running em qualquer momento pode ser rastreado até o commit exato que o gerou — sem ambiguidade de `:latest`.

---

# 9. Qualidade de Software

Objetivo de qualidade:

- Reduzir regressão funcional no fluxo de OS.
- Garantir consistência arquitetural entre domínio, casos de uso e interfaces HTTP.
- Aplicar validação contínua em build, lint e testes automatizados.

Padrões e políticas adotadas:

- Linting: ESLint (`npm run lint`).
- Formatação: Prettier (`npm run format`).
- Testes: Jest + Supertest (`npm run test`, `npm run test:e2e`).
- Contrato de API: Swagger/OpenAPI publicado em `/docs` e `/docs-json`.

Quality gate recomendado para CI:

1. `npm run build`
2. `npm run lint`
3. `npm run test`
4. `npm run test:e2e`
5. `npm audit --omit=dev`

Política de versionamento e commits:

- Recomenda-se Conventional Commits para rastreabilidade de mudança arquitetural e funcional.
- Recomenda-se branch strategy baseada em feature branch + PR com revisão obrigatória.

Critérios mínimos para aceite de PR:

- Build sem erros.
- Sem erro de lint.
- Testes locais (unit + e2e) verdes.
- Mudanças de contrato refletidas no Swagger.

---

# 10. Análise de Vulnerabilidades

### 10.1 Relatório SonarQube final

Relatório dedicado: [docs/relatorios/sonar-relatorio-final.md](./relatorios/sonar-relatorio-final.md)

Resumo da última análise validada durante a sessão:

- Projeto: `oficina-mvp`
- Scanner: `sonarsource/sonar-scanner-cli 8.0.1.6346`
- Resultado da execução do scanner: `EXECUTION SUCCESS`
- Resultado da análise: `ANALYSIS SUCCESSFUL`
- Última execução validada: `24/04/2026 01:15 UTC`
- Dashboard do projeto: `http://localhost:9000/dashboard?id=oficina-mvp`

Métricas de cobertura obtidas na mesma janela de validação:

- Coverage local de referência (`npm run test:cov`): `91.96%` statements, `88.35%` branches, `97.56%` functions, `92.14%` lines
- Controllers com cobertura elevada no Sonar:
  - `src/interfaces/http/ordem-servico.controller.ts`: `94.9%`
  - `src/interfaces/http/peca.controller.ts`: `95.6%`
  - `src/interfaces/http/servico.controller.ts`: `96.7%`

Observação:

- A sessão consolidou a execução bem-sucedida do scanner, a importação de cobertura e o relatório dedicado em docs/relatorios/sonar-relatorio-final.md; 

Baseline do scan de dependências (executado em 2026-04-21):

- `npm audit --json` (grafo completo): 12 vulnerabilidades no total (7 moderadas, 4 altas, 1 crítica).
- `npm audit --omit=dev --json` (somente produção): 3 vulnerabilidades altas em dependências de runtime:
  - `@nestjs/core`
  - `@nestjs/platform-express`
  - `path-to-regexp`

Achados adicionais em dependências de desenvolvimento/tooling:

- Crítica: `handlebars`.
- Alta: `picomatch`.
- Moderadas: cadeia `angular-devkit` e `brace-expansion`.

Priorização de tratamento:

1. Imediato (bloqueador de release): corrigir vulnerabilidades altas em produção (`@nestjs/core`, `@nestjs/platform-express`, `path-to-regexp`) e revalidar build/testes.
2. Curto prazo (próxima iteração): atualizar dependências de tooling com severidade alta/moderada (`handlebars`, `picomatch`, cadeia `angular-devkit`, `brace-expansion`).
3. Planejado (governança contínua): institucionalizar rotina de auditoria de dependências por pipeline e SLA de correção por severidade.

Fluxo de execução e validação:

1. Executar SonarQube quando ambiente estiver disponível.
2. Na indisponibilidade de ambiente Sonar, manter análise conceitual documentada com evidência objetiva de scan (`npm audit`) e risco residual.
3. Após cada mitigação, reexecutar validação mínima:
   - `npm run build`
   - `npm run test`
   - `npm run test:e2e`

Configuração SonarQube no projeto: `sonar-project.properties`.

---

# 11. Execução do Projeto

## 11.1 Como rodar (local)

1. Pré-requisitos: Node.js 20+, npm, Docker (opcional).
2. Instalar dependências: `npm install`.
3. Rodar em dev: `npm run start:dev`.

## 11.2 Scripts úteis

- `npm run test` — rodar testes unitários
- `npm run test:cov` — cobertura global (inclui toda a base)
- `npm run test:cov:critical` — cobertura do escopo crítico (domínio + use-cases)
- `npm run test:e2e` — rodar testes E2E (se configurado)
- `npm run lint` — rodar lint

---

# 12. Considerações Finais

- **Evolução Fase 1 → Fase 2:** migração de persistência in-memory para PostgreSQL via Prisma 7 sem alterar estrutura de domínio ou estratégia de singletons; novas APIs (status, webhook, listagem ordenada) e notificação simulada de e-mail entregues.
-  `Dockerfile` multi-stage corrigido e otimizado; entrypoint com migration automática; infraestrutura como código via Terraform (`/infra` — cluster Kind + Postgres + metrics-server); orquestração Kubernetes (`/k8s` — Deployment, Service, ConfigMap, Secret, HPA min 2/max 5).
- Pipeline CI/CD via GitHub Actions (`.github/workflows/ci-cd.yml`): 4 jobs encadeados `build-lint → test → docker-build → deploy`; imagem publicada no GHCR com rastreabilidade por SHA (`sha-<7chars>`); deploy automatizado end-to-end no cluster Kind com `terraform apply` (IaC declarativa pura via `kubectl_manifest`) + smoke test.

- **Limitações conhecidas:** autenticação sem refresh token; análise de segurança com fallback conceitual quando Sonar não disponível; monitoramento simplificado por timestamps no fluxo da OS; ausência de transações Prisma nos fluxos multi-step.
- **Próximos passos (pós-entrega):**
  1. Transações Prisma para garantir atomicidade nos fluxos de escrita da OS.
  2. Evoluir observabilidade quando houver requisito de produção com SLA.
  3. Migrar singletons para DI pleno do Nest quando o projeto crescer para múltiplos módulos.

## 12.1 Lições Arquiteturais — Referência para Projetos Futuros

Esta subseção consolida os aprendizados práticos desta sprint como referência de decisão para projetos futuros.

### Comece com interfaces, não com implementações

Definir `IOrdemServicoRepository` com `Promise<T>` antes de escrever qualquer repositório concreto forçou o design correto desde o início. O custo de propagar `async` depois (como fizemos na Fase 2) é muito maior do que acertar o contrato de entrada.

**Regra prática:** ao modelar qualquer repositório ou serviço externo, pergunte: *"isso envolve I/O?"*. Se sim, o método retorna `Promise<T>`.

### Seam > Mock pesado para projetos sem DI pleno

Quando o projeto não usa injeção de dependência de framework, o Seam Pattern (variável exportada substituível) é mais simples e mais explícito que configurar `jest.mock` em cada spec. O custo é uma variável mutável em `singletons.ts` — aceitável em processo único, explícito sobre o trade-off.

**Quando migrar para DI pleno:** quando o projeto crescer e precisar de múltiplos módulos com repositórios diferentes, ou quando houver necessidade de injeção por escopo de requisição, migrar os singletons para providers do Nest.

### O domínio é o ativo — infraestrutura é descartável

Durante a migração de in-memory para Prisma, zero linhas do domínio foram alteradas. Apenas a infraestrutura mudou. Isso só é possível porque o domínio não tinha nenhuma dependência para fora de si mesmo.

**Regra prática:** se um `import` dentro de `src/domain/` aponta para `infraestructure/`, `prisma/` ou qualquer biblioteca externa, é um sinal de violação arquitetural.

### Gate de cobertura crítica separado do gate global

O gate global tende a ser puxado para baixo por arquivos de configuração, módulos de bootstrap e infraestrutura que são difíceis de testar unitariamente. Separar o gate crítico (domínio + use cases) permite ter exigência alta onde importa (≥80%) sem que arquivos de infraestrutura dificultem o CI.

### `moduleNameMapper` é a solução para código gerado em Jest CJS

ORMs modernos (Prisma 7, Drizzle) e ferramentas de geração de código tendem a produzir artefatos ESM incompatíveis com Jest CJS. A solução idiomática não é migrar Jest para ESM (alto impacto), mas mapear o import do código gerado para um mock de estrutura equivalente via `moduleNameMapper`.

### Decisões de API contam a história do negócio

- `GET /os/:id/status` — o cliente precisa checar o status sem carregar o objeto completo.
- `POST /os/:id/orcamento/webhook` — o cliente *notifica* a decisão; não é a API que decide por ele.
- `GET /os` com filtro e ordenação — a listagem serve mecânicos e atendentes, não um relatório; o que importa é a fila de trabalho ativa.

Cada nome de rota e regra de negócio tem uma justificativa operacional. Documentar o *porquê* da API (e não só o *o quê*) é o que diferencia documentação arquitetural de documentação técnica.

---

Conforme descrito em `docs/ref/contexto-fase-1.md`, o sistema foi desenvolvido como MVP contemplando requisitos obrigatórios com níveis diferentes de profundidade, priorizando o domínio central e a entrega funcional ponta a ponta.

---
