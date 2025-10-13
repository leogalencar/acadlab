# Gestão de Usuários

## Objetivo
Permitir que administradores e técnicos cadastrem, editem e removam contas de professores, técnicos e outros administradores, garantindo que cada perfil possua apenas os privilégios permitidos.

## Contas de mock geradas pela seed
- **Administrador**: `admin@acadlab.local`
- **Técnico**: `tech@acadlab.local`
- **Professor**: `prof@acadlab.local`
- **Senha padrão**: `ChangeMe123!` (definida em `prisma/seed.ts`; pode ser sobrescrita por variáveis `ADMIN|TECHNICIAN|PROFESSOR_PASSWORD`)

## Passo a passo para preparar o ambiente
1. Configure `DATABASE_URL` no `.env` apontando para o banco MySQL de testes.
2. Instale dependências: `npm install`.
3. Aplique o schema: `npx prisma db push` (ou `npx prisma migrate deploy` se houver migrações).
4. Popule contas de mock: `npx prisma db seed`.
5. Inicie o servidor: `npm run dev`.
6. Acesse `http://localhost:3000/login` e autentique com a conta desejada.

## Roteiro de testes rápidos
1. Acesse `/users` com a conta de administrador e valide:
   - Visualização da lista completa de usuários.
   - Cadastro de um novo professor (formulário “Cadastrar novo usuário”).
   - Edição de um usuário existente (alterar nome/status) e verificação do feedback visual.
   - Exclusão de um usuário de teste recém-criado.
2. Repita com a conta de técnico e confirme que:
   - Apenas professores aparecem na listagem.
   - Não é possível atribuir perfis além de professor.
3. Com a conta de professor:
   - Tentativa de acessar `/users` deve redirecionar para `/dashboard`.
   - Valide que o menu lateral não exibe o módulo “Gestão de Usuários”.

## Observações
- Para alterar dados padrão dos mocks, defina `ADMIN_EMAIL`, `TECHNICIAN_EMAIL`, `PROFESSOR_EMAIL`, `*_NAME` ou `*_PASSWORD` no `.env` antes de rodar `npx prisma db seed`.
- Sempre redefina os dados executando novamente `npx prisma db seed` após limpar o banco para manter um estado previsível. 
