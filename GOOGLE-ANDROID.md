# Entrar com o Google no Android (feito uma única vez)

O app guarda a sincronização e os backups numa pasta oculta do seu Google Drive (a "pasta de
dados do app"). É gratuito. Você cria uma credencial do tipo **Android** e cola o ID no app.

Assinatura do APK (use no passo 5):
- Nome do pacote: `app.tedeaga.mobile`
- SHA-1: `0C:56:BD:1B:B1:E0:CF:3E:A5:B5:BF:76:3C:67:9F:D2:9E:E5:31:B0`
  (é o SHA-1 do arquivo `assets/tedeaga-debug.keystore`; o APK gerado por este projeto sempre usa essa chave)

## Passo a passo
1. Acesse https://console.cloud.google.com e crie um projeto (ex.: TEDEAGA).
   Se você já criou um para a versão desktop, pode reutilizar o mesmo projeto.
2. "APIs e serviços" > "Biblioteca" > ative a **Google Drive API**.
3. "Tela de permissão OAuth": tipo Externo, nome TEDEAGA, seu e-mail. Em "Escopos", adicione
   `.../auth/drive.appdata`. Depois clique em **Publicar aplicativo** (status "Em produção");
   no modo "Teste" o Google desconecta você a cada 7 dias.
4. "Credenciais" > "Criar credenciais" > "ID do cliente OAuth".
5. Tipo de aplicativo: **Android**. Nome do pacote e SHA-1: os valores acima.
   Abra "Configurações avançadas" e **ative "Habilitar esquema de URI personalizado"**
   (sem isso o Google bloqueia o retorno do login para o app). Crie e copie o **ID do cliente**.
6. No TEDEAGA: Ajustes > Conta Google > cole o ID do cliente > Salvar > "Entrar com o Google".
7. O navegador abre; escolha sua conta e permita. Se aparecer "O Google não verificou este app",
   toque em "Avançado" > "Acessar TEDEAGA". Depois do login, o app volta sozinho.

## Observações
- Esse fluxo não pôde ser testado aqui. Se o navegador mostrar "redirect_uri_mismatch" ou
  "invalid_request", confira o nome do pacote, o SHA-1 e se o esquema de URI personalizado
  está habilitado no passo 5.
- A sincronização automática envia as mudanças ~25 s depois e busca a versão mais nova ao abrir
  o app. O backup diário guarda os últimos 7 dias; restaurar fica em Ajustes > Conta Google.
- Papel de parede e áudios próprios não entram na sincronização (só no backup).
- Revogar o acesso: https://myaccount.google.com/permissions
