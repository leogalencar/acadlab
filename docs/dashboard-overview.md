# Painel (Dashboard Overview)

## Objetivo
Apresentar um resumo rápido dos módulos disponíveis para o usuário autenticado, respeitando seu nível de acesso e destacando funcionalidades em breve.

## Contas de mock geradas pela seed
- **Administrador**: `admin@acadlab.local`
- **Técnico**: `tech@acadlab.local`
- **Professor**: `prof@acadlab.local`
- **Senha padrão**: `ChangeMe123!`

## Passo a passo para preparar o ambiente
1. Configure `DATABASE_URL` no `.env`.
2. Execute `npm install`.
3. Aplique o schema com `npx prisma db push`.
4. Popule dados de mock com `npx prisma db seed`.
5. Inicie o app: `npm run dev`.
6. Autentique-se em `http://localhost:3000/login`.

## Checklist de validação
- **Administrador** deve visualizar todos os cards, inclusive “Gestão de Usuários” (status “Disponível”) e os módulos em desenvolvimento (marcados como “Em breve”).
- **Técnico** deve ver “Gestão de Usuários” e os módulos marcados para técnicos/administradores.
- **Professor** deve ver apenas os cards liberados para professores (atualmente os módulos “Agenda de Laboratórios” e “Software e Manutenções”, ainda como “Em breve”).
- Navegue pelo breadcrumb e valide que os rótulos exibem nomes amigáveis (ex.: “Painel”, “Usuários”).

## Observações
- Novos módulos devem ser adicionados em `src/features/dashboard/constants/modules.ts`; mantenha este documento alinhado sempre que houver alterações de rotas ou permissões. 
