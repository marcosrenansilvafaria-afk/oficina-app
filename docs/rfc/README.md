# RFCs - Fase 3 (Arquitetura em Nuvem)

Este diretorio organiza as decisoes de arquitetura de mais amplo alcance
(que afetam multiplos repositorios) em formato RFC. Para decisoes pontuais
de implementacao dentro de um unico repositorio, ver [../adr/](../adr/).

Formato adotado em cada arquivo:
- Titulo
- Data
- Status
- Resumo
- Motivacao
- Alternativas consideradas
- Decisao
- Consequencias
- Relacionado ao PR (associacao textual)

Arquivos atuais:
- [RFC-001-escolha-aws-eks.md](RFC-001-escolha-aws-eks.md) - Escolha da nuvem (AWS) e uso do EKS
- [RFC-002-postgresql-rds.md](RFC-002-postgresql-rds.md) - Escolha do banco de dados gerenciado (RDS PostgreSQL)
- [RFC-003-auth-serverless-cpf-jwt.md](RFC-003-auth-serverless-cpf-jwt.md) - Autenticacao serverless desacoplada via CPF e JWT
