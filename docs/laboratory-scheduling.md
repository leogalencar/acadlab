# Agenda de Laboratórios

## Status
Módulo planejado (“Em breve”). Utilize estas orientações quando a agenda de reservas for disponibilizada.

## Contas de mock geradas pela seed
- **Administrador**: `admin@acadlab.local`
- **Técnico**: `tech@acadlab.local`
- **Professor**: `prof@acadlab.local`
- **Senha padrão**: `ChangeMe123!`

## Passo a passo para preparar o ambiente
1. Ajuste `DATABASE_URL` no `.env`.
2. Instale dependências: `npm install`.
3. Atualize o schema: `npx prisma db push`.
4. Execute `npx prisma db seed` para criar as contas base.
5. Suba o app com `npm run dev`.
6. Autentique com cada perfil para validar regras de permissão assim que as rotas existirem.

## Checklist provisório
- Todos os perfis deverão acessar o card “Agenda de Laboratórios”; por enquanto estará marcado como “Em breve”.
- Planeje casos de teste para:
  - Professor criando, editando e cancelando reservas.
  - Técnico/administrador aprovando, rejeitando ou liberando horários.
- Estruture dados de mock adicionais (laboratórios, horários) para futuros seeds especializados.

## Observações futuras
- Ao implementar, documente endpoints, regras de conflito e notificações neste arquivo.
- Garanta que o módulo reutilize as contas seed para validar regras de acesso entre perfis. 
