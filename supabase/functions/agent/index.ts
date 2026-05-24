// Edge Function: agent
// Recebe { message, history } do AgentePanel, chama Claude com tool use,
// retorna { reply, pendingAction? } onde pendingAction é uma intencao do
// LLM que o frontend vai pedir confirmacao antes de persistir.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const TOOLS = [
  {
    name: "registrar_contrato",
    description:
      "Registra um novo contrato no Plano Anual. Use SEMPRE que o usuario mencionar um contrato fechado, mesmo que faltem alguns campos (usa defaults).",
    input_schema: {
      type: "object",
      properties: {
        cliente: { type: "string", description: "Nome do cliente ou empresa" },
        produto_code: {
          type: "string",
          enum: ["funil", "posic", "estr", "renov", "combo"],
          description: "funil=Funil de Vendas, posic=Posicionamento, estr=Estruturacao Comercial, renov=Renovacao, combo=Combo",
        },
        produto_nome: { type: "string", description: "Nome amigavel do produto" },
        valor: { type: "number", description: "Valor em reais. Se nao mencionado, use ticket padrao do produto." },
        tipo: { type: "string", enum: ["tcv", "mrr"], description: "tcv=contrato unico, mrr=mensalidade recorrente" },
        forma_pagamento: {
          type: "string",
          enum: ["cartao", "avista", "mensalidade", "parcelado"],
        },
        parcelas: {
          type: ["number", "null"],
          description: "Quantidade de parcelas. So usa quando forma_pagamento for cartao ou parcelado.",
        },
        mes: { type: "number", description: "Mes do plano anual (1=Janeiro, 12=Dezembro). Se omitido, usa mes atual." },
      },
      required: ["cliente", "produto_code", "valor", "tipo", "forma_pagamento"],
    },
  },
];

const PRODUTO_NOMES: Record<string, string> = {
  funil: "Funil de Vendas",
  posic: "Posicionamento",
  estr: "Estruturacao Comercial",
  renov: "Renovacao",
  combo: "Combo",
};

const SYSTEM_PROMPT = `Voce e o assistente da plataforma de gestao comercial do Grupo Imperio Digital (assessoria de marketing e vendas para advogados e medicos).

Quem te usa: o CEO Marcos Asafe e os SDRs/closers do time comercial. Eles falam por voz ou texto.

Seu papel: ENTENDER o que o vendedor acabou de fazer e REGISTRAR isso na plataforma usando as ferramentas.

Tom: direto, curto, brasileiro coloquial sem floreio. Nao use "Claro!", "Perfeito!", "Otimo!". Nao use emoji.

Catalogo de produtos (use o code certo):
- funil = Funil de Vendas (TCV R$10.800, MRR R$1.800)
- posic = Posicionamento (MRR R$2.500)
- estr = Estruturacao Comercial (TCV R$15.000, MRR R$1.500)
- renov = Renovacao (TCV R$10.800)
- combo = Combo multi-produto (TCV R$25.800)

REGRAS DE USO DE FERRAMENTA (CRITICO):
1. Mencionou contrato fechado? USE registrar_contrato. Nao pergunte antes — o frontend mostra um card de confirmacao antes de gravar.
2. Faltou campo obrigatorio (cliente, produto)? Pergunte curto antes de chamar.
3. Valor nao mencionado? Use ticket padrao do produto.
4. Forma de pagamento nao mencionada? Assuma "avista" para TCV, "mensalidade" para MRR.
5. Cartao/Parcelado sem qtd de parcelas? Assuma 1.

Exemplo:
Usuario: "Contrato fechado de Vieira Barbosa, Funil de Vendas, 10800 TCV a vista"
Voce: chama registrar_contrato com cliente="Vieira Barbosa", produto_code="funil", produto_nome="Funil de Vendas", valor=10800, tipo="tcv", forma_pagamento="avista".

Quando NAO chamar tool: se for so uma pergunta ("como ta meu mes?"), responda em texto. (Outras ferramentas virao em fases futuras.)`;

interface TextBlock { type: "text"; text: string }
interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
type ContentBlock = TextBlock | ToolUseBlock;
interface AnthropicMessage { role: "user" | "assistant"; content: string | ContentBlock[] }
interface AnthropicResponse { id: string; content: ContentBlock[]; stop_reason: string }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({
      reply:
        "O agente ainda nao foi configurado (falta a API key da Anthropic). Avise o administrador da plataforma.",
    });
  }

  let body: { message?: string; history?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ reply: "Erro: corpo da requisicao invalido." }, 400);
  }

  const userMsg = String(body.message || "").trim();
  if (!userMsg) return jsonResponse({ reply: "Manda uma mensagem pra eu te ajudar." });

  const messages: AnthropicMessage[] = [];
  for (const h of body.history || []) {
    if (h.role === "user" || h.role === "assistant") {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: "user", content: userMsg });

  let claudeResp: Response;
  try {
    claudeResp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });
  } catch (err) {
    return jsonResponse({
      reply: `Nao consegui falar com o Claude: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  if (!claudeResp.ok) {
    const errText = await claudeResp.text();
    console.error("Anthropic error", claudeResp.status, errText);
    return jsonResponse({
      reply: `Erro do servico Claude (${claudeResp.status}). Detalhe: ${errText.slice(0, 300)}`,
    });
  }

  const data = (await claudeResp.json()) as AnthropicResponse;

  let reply = "";
  let pendingAction: unknown = undefined;

  for (const block of data.content) {
    if (block.type === "text") {
      reply += block.text;
    } else if (block.type === "tool_use" && block.name === "registrar_contrato") {
      const a = block.input;
      pendingAction = {
        kind: "registrar_contrato",
        args: {
          produto_code: String(a.produto_code),
          produto_nome: String(a.produto_nome || PRODUTO_NOMES[String(a.produto_code)] || a.produto_code),
          valor: Number(a.valor),
          tipo: String(a.tipo),
          cliente: String(a.cliente),
          formaPagamento: String(a.forma_pagamento),
          parcelas: a.parcelas != null ? Number(a.parcelas) : null,
          mes: a.mes != null ? Number(a.mes) : new Date().getMonth() + 1,
        },
      };
      if (!reply) reply = "Entendi. Confere este registro antes de gravar:";
    }
  }

  if (!reply) reply = "Ok.";

  return jsonResponse({ reply, pendingAction });
});
