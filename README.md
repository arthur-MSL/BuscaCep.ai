# Busca CEP Preciso com IA

Este projeto é uma aplicação web moderna construída com React e TypeScript que utiliza Inteligência Artificial (Google Gemini) para encontrar e validar CEPs e endereços, com suporte especial para zonas rurais.

## Pré-requisitos

*   Node.js (versão 18 ou superior)
*   NPM ou Yarn

## Instalação

1.  Clone o repositório:
    ```bash
    git clone https://seu-usuario/seu-repo.git
    cd busca-cep-preciso
    ```

2.  Instale as dependências:
    ```bash
    npm install
    ```

3.  Configure a API Key do Google Gemini:
    *   Crie um arquivo `.env` na raiz do projeto (baseado no exemplo abaixo).
    *   Adicione sua chave: `API_KEY=sua_chave_aqui`

## Rodando o Projeto

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:5173`.

## Funcionalidades

*   **Busca de CEP por Endereço**: Validação cruzada (ViaCEP + IA).
*   **Busca de Endereço por CEP**: Suporte a BrasilAPI e ViaCEP.
*   **Modo Zona Rural**: Tratamento especial via IA para endereços rurais/sítios.
*   **Histórico Local**: Salva as últimas 5 pesquisas no navegador.
*   **Interface Responsiva**: Design moderno usando Tailwind CSS.

## Tecnologias

*   React
*   TypeScript
*   Vite
*   Google GenAI SDK
*   Tailwind CSS (CDN)
*   Heroicons
