import { GoogleGenAI, Type } from "@google/genai";
import { AddressForm, SearchResult } from "../types";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
// Assume this variable is pre-configured, valid, and accessible in the execution context.
const apiKey = process.env.API_KEY || '';

// Initialize AI conditionally
let ai: GoogleGenAI | null = null;
if (apiKey) {
    try {
        ai = new GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI", e);
    }
}

const MODEL_NAME = 'gemini-3-flash-preview';

// Mapping for full state names to UF
const STATE_TO_UF: Record<string, string> = {
    'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPA': 'AP', 'AMAZONAS': 'AM', 'BAHIA': 'BA',
    'CEARA': 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES', 'GOIAS': 'GO',
    'MARANHAO': 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
    'MINAS GERAIS': 'MG', 'PARA': 'PA', 'PARAIBA': 'PB', 'PARANA': 'PR',
    'PERNAMBUCO': 'PE', 'PIAUI': 'PI', 'RIO DE JANEIRO': 'RJ',
    'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS', 'RONDONIA': 'RO',
    'RORAIMA': 'RR', 'SANTA CATARINA': 'SC', 'SAO PAULO': 'SP', 'SERGIPE': 'SE',
    'TOCANTINS': 'TO'
};

const normalizeText = (text: string) => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const getStateUF = (stateInput: string): string => {
    const cleanState = normalizeText(stateInput).toUpperCase();
    if (cleanState.length === 2) return cleanState;
    return STATE_TO_UF[cleanState] || cleanState.substring(0, 2); // Fallback to first 2 chars
};

export const findCep = async (address: AddressForm): Promise<SearchResult> => {
  const uf = getStateUF(address.state);
  const city = normalizeText(address.city);
  const street = normalizeText(address.street);

  // --- CAMINHO ZONA RURAL ---
  // Se for Rural, pulamos o ViaCEP (que busca logradouros urbanos) e vamos direto pra IA
  // focando em CEP Geral ou de Distrito.
  if (address.isRural) {
    if (!ai || !apiKey) {
      return { found: false, mainText: "Não encontrado", confidence: 'low', secondaryText: "Configure a API Key para buscas rurais complexas." };
    }

    const promptRural = `
      O usuário procura um CEP em ZONA RURAL ou DISTRITO.
      Cidade: ${address.city} - ${address.state}
      Propriedade/Estrada: ${address.street}
      Referência/KM: ${address.number}
      Complemento: ${address.complement || ''}

      Regras para Zona Rural:
      1. Muitas cidades pequenas possuem um CEP ÚNICO (Geral) para toda a zona rural (geralmente final 000 ou o cep da cidade).
      2. Se houver um Distrito mencionado na "Propriedade" ou "Referência", tente achar o CEP específico desse Distrito.
      3. Use o Google Search para verificar se existe um CEP específico para essa estrada rural, caso contrário retorne o CEP Geral da cidade.

      Retorne JSON:
      {
        "found": boolean,
        "cep": string (formato 00000-000),
        "explanation": string (breve explicação, ex: "CEP Geral de [Cidade]" ou "CEP do Distrito de [Nome]"),
        "confidence": "high" | "medium" | "low"
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: promptRural,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: { type: Type.BOOLEAN },
              cep: { type: Type.STRING },
              explanation: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["high", "medium", "low"] }
            },
            required: ["found", "cep", "confidence"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      
      if (!data.found) {
        return { found: false, mainText: "CEP Rural não localizado", confidence: 'low' };
      }

      return {
        found: true,
        mainText: data.cep,
        secondaryText: `${data.explanation || 'Zona Rural'}. Fonte: IA + Google Search`,
        confidence: data.confidence
      };
    } catch (error) {
      console.error("Rural AI Error:", error);
      throw error;
    }
  }

  // --- CAMINHO URBANO PADRÃO (ViaCEP + Fallback IA) ---

  // Validação estrita para a ViaCEP
  if (uf.length === 2 && city.length >= 3 && street.length >= 3) {
    try {
      const url = `https://viacep.com.br/ws/${uf}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
           const match = data[0];
           const moreCount = data.length - 1;
           const secondary = moreCount > 0 
                ? `${match.logradouro} - ${match.bairro} (+${moreCount} resultados). Fonte: ViaCEP`
                : `${match.logradouro} - ${match.bairro}. Fonte: ViaCEP`;

           return {
             found: true,
             mainText: match.cep,
             secondaryText: secondary,
             confidence: moreCount > 0 ? 'medium' : 'high'
           };
        }
      }
    } catch (err) {
      console.warn("Fast search failed, falling back to AI", err);
    }
  }

  // 2. Fallback: Gemini AI (Urbano)
  if (!ai || !apiKey) {
      return { found: false, mainText: "Não encontrado", confidence: 'low', secondaryText: "Verifique o endereço ou configure a API Key" };
  }

  const prompt = `
    Encontre o CEP EXATO para endereço URBANO:
    ${address.street}, número ${address.number}
    ${address.complement ? `Complemento: ${address.complement}` : ''}
    ${address.city} - ${address.state}

    Use Google Search para validar.
    Retorne JSON:
    {
      "found": boolean,
      "cep": string (apenas números e traço, ex: 00000-000),
      "confidence": "high" | "medium" | "low"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: { type: Type.BOOLEAN },
              cep: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["high", "medium", "low"] }
            },
            required: ["found", "cep", "confidence"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    
    if (!data.found) {
      return { found: false, mainText: "CEP não encontrado", confidence: 'low' };
    }

    return {
      found: true,
      mainText: data.cep,
      secondaryText: "Fonte: Google Gemini (IA) + Search",
      confidence: data.confidence
    };
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};

export const findAddress = async (cep: string): Promise<SearchResult> => {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) throw new Error("CEP inválido");

  // 1. Tenta Brasil API (Fonte primária solicitada)
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
    if (response.ok) {
      const data = await response.json();
      const address = `${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}`;
      return {
        found: true,
        mainText: address,
        secondaryText: "Fonte: BrasilAPI (Oficial)",
        confidence: 'high'
      };
    }
  } catch (err) {
    console.warn("Brasil API error, trying ViaCEP fallback", err);
  }

  // 2. Tenta ViaCEP (Fallback de API grátis)
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
            const address = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
            return {
                found: true,
                mainText: address,
                secondaryText: "Fonte: ViaCEP (Oficial)",
                confidence: 'high'
            };
        }
    }
  } catch (err) {
      console.warn("ViaCEP error, falling back to AI", err);
  }

  // 3. Fallback to Gemini
  if (!ai || !apiKey) {
      return { found: false, mainText: "Endereço não encontrado", confidence: 'low' };
  }

  const prompt = `
    Encontre o endereço completo para o CEP: ${cep}.
    Use Google Search para validar.
    Retorne JSON:
    {
      "found": boolean,
      "address": string,
      "confidence": "high" | "medium" | "low"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: { type: Type.BOOLEAN },
              address: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["high", "medium", "low"] }
            },
            required: ["found", "address", "confidence"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");

    if (!data.found) {
      return { found: false, mainText: "Endereço não encontrado", confidence: 'low' };
    }

    return {
      found: true,
      mainText: data.address,
      secondaryText: "Fonte: Google Gemini (IA) + Search",
      confidence: data.confidence
    };
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};