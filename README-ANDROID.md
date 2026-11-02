# TEDEAGA para Android (APK) — versão 1.1.3

O app é o mesmo TEDEAGA (JavaScript), embrulhado com o Capacitor. O projeto gera um APK
que você instala direto no celular (sem Play Store).

> Este pacote ainda não foi compilado nem testado em um aparelho. O primeiro build pode
> pedir pequenos ajustes; se algo falhar, copie a mensagem de erro.

## Caminho A — sem instalar nada (GitHub Actions) — recomendado
O GitHub compila o APK para você, de graça.
1. Crie uma conta em github.com e um repositório novo (pode ser privado).
2. Na pasta `tedeaga-android` (extraída do zip), abra o terminal e rode:
       git init
       git add .
       git commit -m "TEDEAGA android"
       git branch -M main
       git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
       git push -u origin main
   (se o Git não estiver instalado: https://git-scm.com/download/win)
3. No GitHub, abra a aba **Actions**. O fluxo "Gerar APK" roda sozinho (leva ~5–8 min).
   Se não rodar, clique nele > "Run workflow".
4. Quando ficar verde, abra a execução e baixe o arquivo **TEDEAGA-apk** (em "Artifacts").
   Dentro do zip está o `app-debug.apk`.

## Caminho B — no seu computador
1. Instale o **Android Studio** (https://developer.android.com/studio). Abra uma vez e deixe
   baixar o SDK. Ele inclui o JDK necessário.
2. No terminal, dentro da pasta `tedeaga-android`:
       npm install
       npm run apk
   (no PowerShell use `npm.cmd` em vez de `npm` se aparecer erro de scripts desabilitados)
3. O APK final é criado como `TEDEAGA-1.1.3.apk` na própria pasta.

## Instalar no celular
1. Envie o `.apk` para o celular (cabo, Drive, WhatsApp para você mesmo…).
2. Toque no arquivo e permita "Instalar apps desconhecidos" para o app que abriu o arquivo.
3. Ao abrir o TEDEAGA pela primeira vez, **permita as notificações** (necessárias para os alarmes).
4. Em Ajustes do Android > Apps > TEDEAGA > Bateria, escolha **Sem restrições** para os alarmes
   tocarem sempre.

## Sincronizar PC e celular
Veja `SINCRONIZAR.md`: por Wi-Fi (direto, sem conta) ou pela conta Google.

## Como cada recurso foi adaptado
| Recurso | No Android |
|---|---|
| Agenda, tarefas, planos, metas, finanças, gastos fixos, rotina, **nutrição** (refeições, plano semanal, anotações, gráficos), widgets do app | Iguais ao app (dados salvos no aparelho). |
| Alarmes | Notificações agendadas pelo Android (tocam com o app fechado e após reiniciar o celular). Frequência (todos os dias, úteis, fins de semana, dias específicos, uma vez), silenciar, +5 min e Desativar funcionam. Os 6 sons prontos tocam com o app fechado. |
| Sons enviados por você | Tocam quando o app está aberto. Com o app fechado, o Android só aceita sons empacotados no app, então toca o som pronto mais próximo ("Bipe" se não houver). |
| Widgets da área de trabalho | Viram **widgets da tela inicial do Android**: Agenda, Rotina de hoje, Contas a vencer e Nutrição de hoje (segure na tela inicial > Widgets > TEDEAGA). Atualizam quando você usa o app e a cada 30 min. |
| Conta Google (login, sincronização, backup diário) | Funciona com o mesmo esquema do desktop (pasta oculta do Drive). Veja `GOOGLE-ANDROID.md`. |
| Mascote com IA | Precisa da sua chave da Anthropic (Ajustes > Chave da IA). A chave fica guardada no app, só neste aparelho. |
| Mascote: círculos / vai e vem | No toque: **arraste** o mascote com o dedo; **sacuda o celular** para ele se afastar; círculos com o dedo chamam o mascote quando a tela não está rolando. Dá para desligar em "Reagir ao mouse". |
| Efeitos sobre o papel de parede, distorção, stickers, punk, maquiagem, importação com IA | Iguais ao app. Efeitos pesados podem gastar bateria: reduza a intensidade se necessário. |
| Backup em arquivo | "Baixar backup" abre o compartilhamento do Android (salve no Drive, e-mail etc.). Restaurar usa o seletor de arquivos. |
| Importar .xlsx | Precisa de internet na primeira leitura (leitor carregado da internet); .csv funciona sempre. |
| Colaboração em tempo real | Só na versão web. |

## Atualizar depois
Rode de novo o Caminho A (faça `git add . && git commit -m novo && git push`) ou B.
O APK novo instala por cima do anterior e mantém os dados, porque usa sempre a mesma
chave de assinatura (`assets/tedeaga-debug.keystore`). **Não apague esse arquivo.**
Para uma versão nova, aumente o número em `package.json`, em `scripts/setup.js`
(`versionName`/`versionCode`) e em `scripts/build-apk.js`.

## Estrutura
- `www/` — o app (HTML, CSS, JS) e `mobile.js` (ponte com o Android)
- `native/` — código Android: widgets (Java), ícones, sons dos alarmes
- `scripts/setup.js` — cria a pasta `android/` e aplica as personalizações
- `.github/workflows/build-apk.yml` — compilação automática no GitHub
