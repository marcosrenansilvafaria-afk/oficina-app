# ADR-012 - Segregacao em 4 repositorios com CI/CD autonomo e remote state

Data: 15/09/2026
Status: Aceita

## Contexto
A Fase 2 mantinha banco de dados, infraestrutura K8s e aplicacao em um
unico repositorio (monorepo). A Fase 3 exige separar a arquitetura em 4
repositorios independentes (banco, auth serverless, cluster K8s, aplicacao),
cada um com seu proprio pipeline de CI/CD, para simular equipes/ciclos de
deploy independentes em um cenario real de nuvem corporativa.

## Decisao
Criar 4 repositorios Git independentes (`oficina-db-infrastructure`,
`oficina-lambda-auth`, `oficina-k8s-infrastructure`, `oficina-app`), cada
um com:
- Terraform proprio com backend remoto S3, todos compartilhando o MESMO
  bucket de state (`oficina-tfstate-<account-id>`) com uma `key` diferente
  por repositorio, e a MESMA tabela DynamoDB de lock.
- Dependencias entre repositorios resolvidas via `terraform_remote_state`
  (leitura read-only do state de outro repositorio), nunca duplicando
  configuracao manualmente (ex: Repositorio 2 e 3 leem VPC/subnets/SG do
  Repositorio 1 via remote state).
- IAM Role dedicada por repositorio (OIDC do GitHub Actions), com
  permissoes escopadas ao minimo necessario para aquele repositorio
  especificamente gerenciar seus proprios recursos.
- Pipeline propria: `lint/validate` -> `plan` (em PRs) -> `apply/deploy`
  (push em `main`, com aprovacao manual via GitHub Environment).

## Consequencias
- Positivas: cada repositorio pode ser versionado, revisado e implantado de
  forma independente; falha de deploy em um repositorio nao trava os
  demais; permissoes IAM minimas reduzem o raio de impacto de credenciais
  vazadas de um unico repositorio.
- Negativas: complexidade operacional real de coordenar 4 pipelines e 4
  IAM Roles distintas; qualquer mudanca que afete mais de um repositorio
  (ex: novo output no Repositorio 1) exige coordenar commits em mais de um
  lugar; descoberto na pratica que o claim `sub` do OIDC do GitHub Actions
  inclui IDs numericos imutaveis nao documentados nos exemplos padrao da
  AWS, exigindo trust policies com wildcard em todas as 4 roles.
- Ordem de aplicacao real determinada pelas dependencias de remote state:
  Repositorio 1 -> Repositorio 3 (EKS) -> Repositorio 2 (Lambda) ->
  Repositorio 4 (app).

Relacionado ao PR #fase3-adr-012
