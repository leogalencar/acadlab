# Gestão de Laboratórios e Recursos

## Status
Módulo em planejamento (“Em breve”). As diretrizes abaixo ajudam a preparar cenários de teste quando o recurso for ativado.

## Contas de mock geradas pela seed
- **Administrador**: `admin@acadlab.local`
- **Técnico**: `tech@acadlab.local`
- **Professor**: `prof@acadlab.local`
- **Senha padrão**: `ChangeMe123!`

## Passo a passo para preparar o ambiente
1. Defina `DATABASE_URL` no `.env`.
2. Execute `npm install`.
3. Rode `npx prisma db push`.
4. Popule as contas mock com `npx prisma db seed`.
5. Inicie `npm run dev`.
6. Autentique-se com a conta de administrador ou técnico.

## Checklist provisório
- Confirme que o card “Gestão de Laboratórios e Recursos” aparece apenas para administradores e técnicos e está marcado como “Em breve”.
- Verifique que o breadcrumb exibe corretamente “Laboratórios” ao acessar `/dashboard/laboratories` (quando implementado).
- Prepare dados adicionais relevantes (laboratórios, recursos) em scripts separados para quando o módulo estiver disponível.

## Observações futuras
- Planeje seed complementar criando laboratórios e relacionando técnicos responsáveis.
- Documente o fluxo de criação/edição/remoção assim que as rotas de API e componentes forem entregues.
