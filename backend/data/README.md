# backend/data — dados de migração

Este diretório é **gitignored** por padrão (`backend/data/*` no `.gitignore`
da raiz). Apenas arquivos `.enc` (criptografados) podem ser commitados.

## Arquivos esperados

| Arquivo                          | Commitado? | Conteúdo                                                   |
|----------------------------------|------------|------------------------------------------------------------|
| `backup_adm_clube.csv.enc`       | ✅ sim     | CSV do sistema antigo ADM CLUBE, criptografado AES-256-CBC |
| `backup_adm_clube.csv`           | ❌ não     | CSV em claro — PII de 1.300+ sócios; gerado pelo decrypt   |
| `migration-report.json`          | ❌ não     | Relatório gerado pela migração — também tem PII            |

## Fluxo no `start-dev.bat` (novo PC)

1. Detecta se o banco já tem ≥ 100 associados → pula migração.
2. Caso vazio: pede a passphrase (ou usa `MIGRATION_PASSPHRASE` do `backend/.env`).
3. Descriptografa `backup_adm_clube.csv.enc` → `backup_adm_clube.csv`.
4. Roda `npm run migrate:adm:apply -- --yes` (cleanup + import).
5. Roda `npx tsx scripts/migrate-patch-missing.ts` (resgate dos sócios perdidos).

Passphrase fica em `backend/.env`. Como `.env` é gitignored, cada PC precisa
informar a passphrase na primeira vez (depois fica armazenada localmente).

## Re-criptografar (admin)

Se um novo backup do sistema antigo chegar, gerar nova versão com:

```powershell
cd backend
npx tsx scripts/csv-crypto.ts encrypt data/backup_adm_clube.csv data/backup_adm_clube.csv.enc
# Vai pedir a passphrase
```
