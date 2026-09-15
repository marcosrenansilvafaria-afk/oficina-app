# 📅 Plano de Sprints Refatorado (100% de Cobertura dos Requisitos)

## 🏃‍♂️ Sprint 1: Refatoração, Novas APIs e Banco de Dados (Código)

**Foco:** Cumprir toda a evolução de software exigida.

### Tarefa 1.1 — Persistência Real

* Configurar o PostgreSQL e o `docker-compose` local.
* Criar a estrutura do banco mantendo os princípios de Clean Code e Clean Architecture da Fase 1.

### Tarefa 1.2 — API de Abertura de OS

* Ajustar/criar o endpoint para receber:

  * Cliente
  * Veículo
  * Serviços
  * Peças
* Retornar o ID único da Ordem de Serviço (OS).

### Tarefa 1.3 — API de Consulta de Status

Garantir o endpoint que retorna estritamente os seguintes status:

* Recebida
* Diagnóstico
* Aguardando Aprovação
* Execução
* Finalizada
* Entregue

### Tarefa 1.4 — API de Aprovação de Orçamento

* Criar o endpoint de webhook para receber notificações externas de:

  * Aprovação do cliente
  * Recusa do cliente

### Tarefa 1.5 — API de Listagem Ordenada (Crítico)

Implementar a query de listagem com a lógica exata da banca:

#### Ordenação

1. Em Execução
2. Aguardando Aprovação
3. Diagnóstico
4. Recebida

#### Filtro Secundário

* Mais antigas primeiro (`createdAt ASC`)

#### Exclusão Lógica

* Ocultar as OS com status:

  * Finalizada
  * Entregue

### Tarefa 1.6 — Notificação de Alteração de Status

* Implementar um serviço (Nodemailer ou Mock simples) que dispara uma simulação de e-mail toda vez que o status da OS mudar.

### Tarefa 1.7 — Testes Automatizados

* Atualizar e executar os testes unitários e de integração.
* Cobrir os fluxos críticos utilizando o novo banco de dados.

---

## ☸️ Sprint 2: Infraestrutura como Código (IaC) & Orquestração Kubernetes

**Foco:** Cumprir os requisitos de infraestrutura moderna.

### Tarefa 2.1 — Docker

* Atualizar o `Dockerfile` (multi-stage).
* Atualizar o `docker-compose.yml`.
* Garantir o funcionamento local da API e do banco de dados.

### Tarefa 2.2 — Terraform (`/infra`)

Criar scripts Terraform para provisionar:

* Cluster Kubernetes (Minikube local ou Cloud)
* Banco de Dados

### Tarefa 2.3 — Manifestos Kubernetes (`/k8s`)

Criar os arquivos YAML contendo:

#### Aplicação

* Deployment
* Service

#### Configuração

* ConfigMaps
* Secrets para:

  * Credenciais do banco
  * Tokens externos

#### Escalabilidade

* Horizontal Pod Autoscaler (HPA)
* Escalonamento por CPU e/ou memória

---

## 🚀 Sprint 3: Automação CI/CD (GitHub Actions)

**Foco:** Garantir que o pipeline execute todas as etapas obrigatórias na ordem correta.

### Tarefa 3.1 — Pipeline de CI/CD

Criar uma esteira automatizada que execute a cada push:

1. Build da aplicação NestJS
2. Execução dos testes automatizados
3. Build da imagem Docker
4. Deploy do banco de dados no cluster
5. Deploy da aplicação no cluster Kubernetes utilizando os manifestos YAML

---

## 📄 Sprint 4: Documentação Oblíqua & Entregáveis

**Foco:** Blindar a nota garantindo que nenhum item de validação visual fique de fora.

### Tarefa 4.1 — Swagger / Postman

* Gerar o link público da collection.
* Incluir todos os endpoints novos e ajustados.

### Tarefa 4.2 — README.md Completo

Atualizar a raiz do repositório contendo:

#### Descrição da Solução

* Objetivos da solução
* Contexto do projeto

#### Arquitetura

* Componentes da aplicação
* Infraestrutura provisionada
* Fluxo de deploy

#### Guias de Execução

* Execução local
* Deploy em Kubernetes
* Provisionamento via Terraform

### Tarefa 4.3 — Gravação do Vídeo de 15 Minutos

Gravar a tela demonstrando, sem cortes:

* Pipeline CI/CD em execução
* Deploy da aplicação no Kubernetes
* Consumo das novas APIs
* Teste de carga simulando aumento de tráfego
* HPA escalando os pods em tempo real

---

# ⏱️ Estimativa Real de Tempo (Fase 2 Completa)

Por envolver diversas frentes de DevOps e configuração de pipelines, o tempo estimado é ligeiramente maior, mas perfeitamente executável.

| Sprint   | Escopo                        | Tempo Estimado |
| -------- | ----------------------------- | -------------- |
| Sprint 1 | Código, APIs e Banco de Dados | 10 a 12 horas  |
| Sprint 2 | Terraform e Kubernetes        | 12 a 14 horas  |
| Sprint 3 | Pipeline CI/CD                | 6 a 8 horas    |
| Sprint 4 | Documentação e Vídeo          | 6 a 8 horas    |

## Tempo Total Estimado

**34 a 42 horas de trabalho**


## Conceitos para rever:Conceito	Onde está no projeto
Multi-stage build	Dockerfile — stage build + stage runtime
Imagem sem segredo	Sem COPY .env; variáveis chegam por environment: no compose ou Secret K8s
Usuário não-root	USER appuser no stage runtime
Graceful shutdown	exec node dist/main.js no entrypoint
IaC declarativa	/infra/*.tf — Terraform descreve estado desejado
Idempotência	terraform apply e prisma migrate deploy são idempotentes
Namespace K8s	Isolamento de recursos (oficina)
ConfigMap vs Secret	Separação por sensibilidade
Liveness vs Readiness	Diferentes consequências de falha
Resources requests/limits	Obrigatório para HPA funcionar
HPA	Autoscaling horizontal baseado em observabilidade
PVC	Persistência de dados além do ciclo de vida do Pod
Job K8s	Tarefa única (migration) separada do Deployment
metrics-server	Provedor da metrics API — habilita o HPA

jwt_token: 7cc60abf3f6613ed900a1d6bcf189a4373d718293a880e42703d0168162c6dd4
EXTERNAL_WEBHOOK_TOKEN = mrsfrif_external