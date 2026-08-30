const Groq = require("groq-sdk");

async function askAI(prompt, stateContext) {
  let groqRes = null;
  const apiKey = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
  const modelName = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  
  const systemPrompt = `Você é o Mestre Narrador de um RPG de horror e investigação sobrenatural, sombrio, misterioso e imersivo.
Seu objetivo é narrar as consequências das ações do(s) jogador(es) com detalhes atmosféricos, mantendo o suspense e a coerência da cena.
Você recebe a ação do jogador e o estado atual completo (PV, PE, SAN, inventário, localização).
Sua resposta DEVE ser estritamente em formato JSON válido com TODOS os campos:
{
  "narration": "Narração rica e atmosférica do resultado da ação. Descreva o ambiente, tensão e as consequências imediatas.",
  "state_updates": {
    "pv_current": null,
    "pe_current": null,
    "san_current": null,
    "location": null,
    "status_add": [],
    "status_remove": []
  },
  "inventory_updates": { "add": [], "remove": [] },
  "contextual_suggestions": [
    "Sugestão contextual 1 (ex: ação de investigação ou perícia no ambiente atual)",
    "Sugestão contextual 2 (ex: interação tática ou ambiental condizente)",
    "Sugestão contextual 3 (ex: ação defensiva, ofensiva ou cautelosa)"
  ],
  "pending_dice": { "required": false, "attribute": "intelecto", "cd": 15, "reason": "" }
}
REGRAS OBRIGATÓRIAS:
1. Em TODAS as respostas forneça 3 ou 4 "contextual_suggestions" coerentes com a cena, sem spoilers.
2. Exija rolagens (pending_dice.required = true) para ações arriscadas (explorar, atacar, decifrar, fugir).
3. APLIQUE DANO REALISTA: Se a ação envolver perigo, entidade, ou falha implícita, reduza pv_current ou san_current do personagem (ex: -3 a -8 PV para ataques de entidade, -2 a -5 SAN para eventos paranormais).
4. Se o personagem usar habilidade com custo de PE informado no contexto, reduza pe_current.
5. Se o personagem se curar ou recuperar recursos, aumente os valores correspondentes (nunca ultrapassar o máximo).
6. SEMPRE preencha state_updates com os NOVOS VALORES ABSOLUTOS (não incrementais). Use null para o que não mudar.
7. Não inclua Markdown ao redor do JSON, apenas o objeto JSON puro.`;

  const userMessage = `ESTADO ATUAL DO PERSONAGEM:
${JSON.stringify(stateContext, null, 2)}

AÇÃO DO JOGADOR: ${prompt}

IMPORTANTE: Responda apenas com JSON puro. Use os valores atuais de PV/PE/SAN acima como base para calcular state_updates.`;

  // Tenta GROQ primeiro
  if (apiKey && apiKey !== "gsk_placeholder_aqui_precisa_substituir") {
    try {
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        model: modelName,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      groqRes = completion.choices[0]?.message?.content;
    } catch (e) {
      console.warn(`[aiOrchestrator] Falha no modelo Groq (${modelName}), tentando modelo de fallback...`, e.message);
      try {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          response_format: { type: "json_object" }
        });
        groqRes = completion.choices[0]?.message?.content;
      } catch (err2) {
        console.warn("[aiOrchestrator] Falha no Groq fallback, tentando Ollama...", err2.message);
      }
    }
  }

  // Fallback para Ollama
  if (!groqRes) {
    try {
      const fetchFn = typeof globalThis.fetch === "function" ? globalThis.fetch : null;
      if (!fetchFn) throw new Error("Fetch não disponível neste ambiente");
      const r = await fetchFn("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3", // Ou mistral
          system: systemPrompt,
          prompt: userMessage,
          stream: false,
          format: "json"
        })
      });
      if (r.ok) {
        const data = await r.json();
        groqRes = data.response;
      } else {
        throw new Error("Ollama retornou erro: " + r.status);
      }
    } catch (e) {
      console.warn("[aiOrchestrator] Falha no Ollama:", e.message);
      // Fallback final genérico determinístico se ambas falharem
      return generateFallback(prompt);
    }
  }

  try {
    return JSON.parse(groqRes);
  } catch (e) {
    console.error("[aiOrchestrator] Falha ao fazer parse do JSON da IA:", groqRes);
    return generateFallback(prompt);
  }
}

function generateFallback(action) {
  return {
    narration: "A entidade não responde. A ação acontece, mas as consequências são imprevisíveis. Você deve prosseguir.",
    state_updates: { pv_current: null, pe_current: null, san_current: null, location: null, status_add: [], status_remove: [] },
    inventory_updates: { add: [], remove: [] },
    contextual_suggestions: ["Observar novamente", "Fugir", "Se preparar"],
    pending_dice: { required: true, attribute: "agilidade", cd: 10, reason: "Teste instintivo devido à anomalia." }
  };
}

module.exports = { askAI };
