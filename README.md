# Gerador de banners para Opentalk

- Instale as dependências com `npm install`
- Instale as fontes de fonts.zip na sua máquina 

## Como usar

`node index.js ./test.json`

### Github handle

Para facilitar o script o campo `github` do speaker é usado para baixar a foto
do usuário do github colocado ali. Caso você já tenha a imagem, salve-a na
pasta como `.cache/${github_handle}.jpeg` e o script pulará a fase de download
do arquivo do github.
