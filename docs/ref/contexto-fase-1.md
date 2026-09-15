# 📌 Contexto do Projeto — Sistema de Oficina Mecânica (MVP)

---

## 🎯 Objetivo

Desenvolver um sistema backend (MVP) para gestão de Ordens de Serviço (OS) em uma oficina mecânica, aplicando:

- Domain-Driven Design (DDD)
- Clean Architecture
- Boas práticas de desenvolvimento

O sistema visa resolver problemas como:
- Desorganização do fluxo de atendimento
- Falta de rastreabilidade de serviços
- Dificuldade de acompanhamento de status
- Controle ineficiente de peças e serviços

---

# 🧠 Estratégia de Implementação (MVP)

Como se trata de um MVP, todos os requisitos foram considerados, porém implementados com diferentes níveis de profundidade, priorizando:

- Núcleo do domínio (Ordem de Serviço)
- Fluxos críticos do sistema
- Clareza arquitetural

---

# 🧩 REQUISITOS FUNCIONAIS

---

## 🔴 RF1 — Gestão de Ordem de Serviço (ALTO IMPACTO)

### Funcionalidades:

- Criação de OS
- Associação com cliente e veículo
- Inclusão de serviços e peças
- Geração automática de orçamento
- Aprovação de orçamento
- Execução e finalização
- Entrega do veículo
- Consulta de OS

### Status da OS:

- RECEBIDA  
- EM_DIAGNOSTICO  
- AGUARDANDO_APROVACAO  
- APROVADA  
- EM_EXECUCAO  
- FINALIZADA  
- ENTREGUE  

### Implementação:

✔ COMPLETA e com regras de domínio  
✔ Controle de estados garantido no domínio  

---

## 🟠 RF2 — Gestão de Cliente e Veículo (MÉDIO IMPACTO)

### Funcionalidades:

- Cadastro de cliente (CPF/CNPJ)
- Cadastro de veículo (placa, modelo, marca, ano)
- Associação com OS

### Implementação:

✔ CRUD básico (Create + Get)  
✔ Validação simplificada  

💡 Justificativa:
Foco no vínculo com OS, não na complexidade do cadastro

---

## 🟠 RF3 — Gestão de Serviços e Peças (MÉDIO IMPACTO)

### Funcionalidades:

- Cadastro de serviços
- Cadastro de peças
- Associação com OS
- Controle básico de estoque

### Implementação:

✔ CRUD simplificado  
✔ Estoque representado por campo numérico  

💡 Justificativa:
Controle simplificado suficiente para MVP

---

## 🟡 RF4 — Listagem e Consulta (MÉDIO/BAIXO IMPACTO)

### Funcionalidades:

- Listar OS
- Detalhar OS

### Implementação:

✔ Endpoint básico  

---

## 🟡 RF5 — Monitoramento de tempo (BAIXO IMPACTO)

### Funcionalidade:

- Tempo médio de execução

### Implementação:

✔ Implementação simples com timestamps e cálculo de média

💡 Justificativa:
Suficiente para o MVP e rastreia o comportamento do fluxo principal

---

# 🔐 REQUISITOS NÃO FUNCIONAIS

---

## 🔴 RNF1 — Arquitetura (ALTO IMPACTO)

- Monólito em camadas
- Separação de responsabilidades
- DDD aplicado no domínio

✔ Implementado completamente

---

## 🔴 RNF2 — API REST (ALTO IMPACTO)

- Endpoints RESTful
- Organização clara

✔ Implementado

---

## 🟠 RNF3 — Documentação (ALTO IMPACTO)

- README completo
- Descrição de arquitetura
- Endpoints documentados

✔ Implementado

---

## 🟡 RNF4 — Validação de dados (MÉDIO IMPACTO)

- CPF/CNPJ
- Placa

✔ Implementação simplificada  

💡 Justificativa:
Validação básica suficiente para MVP

---

## 🟡 RNF5 — Testes automatizados (MÉDIO IMPACTO)

- Testes de domínio
- Testes de fluxo principal

✔ Implementação ampliada com testes unitários e E2E dos fluxos críticos

💡 Justificativa:
Foco nos fluxos críticos sem tentar cobrir cenários fora do escopo do MVP

---

## 🔵 RNF6 — Segurança (JWT) (BAIXO IMPACTO)

- Autenticação em endpoints administrativos

✔ Implementação simplificada com JWT + RBAC

💡 Justificativa:
Suficiente para o cenário do MVP, mantendo payload mínimo e controle por perfil

---

## 🔵 RNF7 — Banco de dados (MÉDIO IMPACTO)

- Persistência dos dados

✔ Implementação in-memory  

💡 Justificativa:
Foco na modelagem de domínio e simplicidade

---

## 🔵 RNF8 — Docker (BAIXO IMPACTO)

- Containerização da aplicação

✔ Implementação configurada com Docker e docker-compose

---

## 🔵 RNF9 — Swagger (BAIXO IMPACTO)

- Documentação da API

✔ Implementação disponível e publicada na API

---

# 🧱 Arquitetura

## Camadas:

- Domain → regras e entidades
- Application → casos de uso
- Interface → controllers HTTP
- Infrastructure → persistência

```plantuml
@startuml
!theme materia
package Domain
package Application
package Interface
package Infrastructure

Interface --> Application
Application --> Domain
Infrastructure --> Application
@enduml
```

---

# 🧠 Decisões Arquiteturais

### DDD
Aplicado para garantir centralização das regras no domínio.

### Clean Architecture
Separação clara de responsabilidades.

### Persistência em memória
Adotada para reduzir complexidade e focar no domínio.

### Escopo controlado
Priorização do fluxo de OS como núcleo do sistema.

---

# 🔁 Fluxo Principal

1. Criar OS (cliente + veículo)
2. Iniciar diagnóstico
3. Adicionar itens
4. Gerar orçamento
5. Aprovar
6. Executar
7. Finalizar
8. Entregar

---

# 🎯 Conclusão

O sistema foi desenvolvido como MVP, contemplando todos os requisitos obrigatórios, porém com níveis diferentes de profundidade, priorizando:

- Domínio central
- Clareza arquitetural
- Funcionalidade ponta a ponta

Essa abordagem garante:
- Entrega funcional
- Escalabilidade futura
- Qualidade de modelagem

# 1. Introdução

## 1.1 Contexto do problema

A oficina mecânica enfrentava problemas operacionais devido ao uso de processos manuais e planilhas, resultando em:

- Falhas no controle de serviços
- Dificuldade no acompanhamento do status das ordens
- Perda de histórico de clientes e veículos
- Ineficiência no fluxo de aprovação de orçamentos

O sistema proposto busca centralizar e organizar esses processos, garantindo rastreabilidade e controle.

---

## 1.2 Objetivo do sistema

Desenvolver um backend (MVP) para gestão de Ordens de Serviço (OS), permitindo:

- Controle do ciclo completo de atendimento
- Organização dos dados de clientes e veículos
- Gestão de serviços e peças
- Acompanhamento do status da OS via API

---

## 1.3 Escopo do MVP

Inclui:

- Ordens de Serviço (OS)
- Clientes
- Veículos
- Serviços
- Peças

Fora do escopo (MVP):

- Autenticação completa (JWT avançado)
- Persistência em banco de dados
- Monitoramento avançado (tempo médio)
- Controle avançado de estoque

---

# 2. Requisitos

## 2.1 Requisitos Funcionais

### 2.1.1 Fluxo de OS

- RF-OS-01: Criar Ordem de Serviço  
  - Entrada: clienteId, veiculoId  
  - Validação: cliente e veículo devem existir  

- RF-OS-02: Adicionar itens  
  - Permitido apenas em: RECEBIDA, EM_DIAGNOSTICO  
  - Tipos: SERVICO | PECA  

- RF-OS-03: Gerar orçamento  
  - Soma automática dos itens  

- RF-OS-04: Aprovar orçamento  
  - Altera status para APROVADA  

- RF-OS-05: Iniciar execução  
  - Apenas se status = APROVADA  

- RF-OS-06: Finalizar OS  
  - Apenas se status = EM_EXECUCAO  

- RF-OS-07: Entregar veículo  
  - Apenas se status = FINALIZADA  

- RF-OS-08: Consultar OS  
  - GET por id  
  - Listagem geral  

---

### 2.1.2 Gestão administrativa

- RF-ADM-01: Cliente  
  - Criar cliente  
  - Buscar cliente  

- RF-ADM-02: Veículo  
  - Criar veículo  
  - Buscar veículo  

- RF-ADM-03: Peças  
  - Cadastro simples  
  - Controle básico de estoque  

- RF-ADM-04: Serviços  
  - Cadastro simples  

- RF-ADM-05: Relatórios  
  - Não implementado (fora do escopo do MVP)

---

## 2.2 Requisitos Não Funcionais

### 2.2.1 Arquitetura

- DDD aplicado
- Clean Architecture
- Monólito em camadas

📌 Inserir diagrama de camadas (HLD) aqui  
👉 (draw.io ou imagem)

---

### 2.2.2 Segurança

- Validação básica de dados (documento, campos obrigatórios)
- JWT não implementado (justificado como simplificação do MVP)

---

### 2.2.3 Performance

- Uso de armazenamento in-memory
- Baixo tempo de resposta esperado

---