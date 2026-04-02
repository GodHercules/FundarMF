const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const fsSync = require("fs");
const { PrismaClient } = require(
  path.resolve(__dirname, "..", "backend", "api", "node_modules", "@prisma", "client")
);

const API_BASE = process.env.API_BASE ?? "http://localhost:4000";
const PDF_PATH =
  process.env.E2E_PDF_PATH ??
  "C:\\Users\\PC\\Downloads\\Portarian671de1denovembrode2021.pdf";
const REPORT_PATH =
  process.env.E2E_REPORT_PATH ??
  path.resolve(__dirname, "..", "docs", "local-form-test-report.md");

const COOKIE_NAME = "fundarmf_session";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, "..", "backend", ".env");
  if (!fsSync.existsSync(envPath)) return;
  const content = fsSync.readFileSync(envPath, "utf-8");
  const line = content.split(/\r?\n/).find((row) => row.startsWith("DATABASE_URL="));
  if (line) {
    process.env.DATABASE_URL = line.slice("DATABASE_URL=".length);
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildCookie(token) {
  return `${COOKIE_NAME}=${token}`;
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function ensureFile(pathValue) {
  try {
    const stat = await fs.stat(pathValue);
    return stat.size;
  } catch (err) {
    throw new Error(`Arquivo não encontrado: ${pathValue}`);
  }
}

async function main() {
  loadDatabaseUrl();
  const startedAt = new Date();
  const prisma = new PrismaClient();
  const report = [];

  report.push(`# Relatório de Teste Local - Formulário do Cliente`);
  report.push(`- Data: ${startedAt.toISOString()}`);
  report.push(`- API Base: ${API_BASE}`);
  report.push(`- PDF: ${PDF_PATH}`);
  report.push("");

  const pdfSize = await ensureFile(PDF_PATH);
  report.push(`## Arquivo de teste`);
  report.push(`- Tamanho: ${(pdfSize / 1024).toFixed(1)} KB`);
  report.push("");

  const master = await prisma.user.findUnique({
    where: { email: "master@fundarmf.com.br" },
    select: { id: true, email: true }
  });
  if (!master) {
    throw new Error("Usuário master não encontrado. Rode o seed antes.");
  }

  const masterToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      role: "MASTER",
      userId: master.id,
      clientEmail: null,
      clientWhatsapp: null,
      tokenHash: hashToken(masterToken),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      lastActiveAt: new Date()
    }
  });

  const clientEmail = "tecnologia@mfcontabilidadeba.com.br";
  const clientPhone = "+5571987034124";

  const createPayload = {
    nome: "Tecnologia",
    email: clientEmail,
    telefone: clientPhone,
    sendEmail: false,
    sendWhatsapp: false
  };

  report.push(`## 1) Criar processo (MASTER)`);
  const createResp = await requestJson(`${API_BASE}/processes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: buildCookie(masterToken)
    },
    body: JSON.stringify(createPayload)
  });

  report.push(`- Status: ${createResp.res.status}`);
  if (!createResp.res.ok) {
    report.push(`- Erro: ${JSON.stringify(createResp.body)}`);
    await fs.writeFile(REPORT_PATH, report.join("\n"));
    throw new Error("Falha ao criar processo.");
  }

  const processId = createResp.body?.process?.id ?? createResp.body?.id;
  if (!processId) {
    report.push(`- Resposta inesperada: ${createResp.text}`);
    await fs.writeFile(REPORT_PATH, report.join("\n"));
    throw new Error("Processo não retornado pela API.");
  }
  report.push(`- Process ID: ${processId}`);
  report.push("");

  const clientToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      role: "CLIENTE",
      userId: null,
      clientEmail,
      clientWhatsapp: clientPhone,
      tokenHash: hashToken(clientToken),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      lastActiveAt: new Date()
    }
  });

  const socio1Id = crypto.randomUUID();
  const socio2Id = crypto.randomUUID();

  const step2Payload = {
    razaoSocial1: "Tecnologia",
    razaoSocial2: "teste",
    razaoSocial3: "teste2",
    municipio: "Salvador - BA",
    emailCnpj: clientEmail,
    telefoneCnpj: clientPhone,
    quadroSocietario: [
      {
        socioId: socio1Id,
        tipoPessoa: "CPF",
        socioNome: "Ively Paixão Santos",
        socioCpf: "859.851.725-97",
        socioEmail: clientEmail,
        socioTelefone: clientPhone,
        socioPercentual: "50%",
        socioAdministrador: "Sim",
        socioEstadoCivil: "Casado(a)",
        socioProfissao: "Biomedica",
        socioRegimeCasamento: "Comunhão parcial de bens"
      },
      {
        socioId: socio2Id,
        tipoPessoa: "CNPJ",
        socioRazaoSocial: "TechTDHA",
        socioCnpj: "44.953.520/0001-94",
        socioEmail: clientEmail,
        socioTelefone: clientPhone,
        socioPercentual: "50%",
        socioAdministrador: "Não",
        adminNomeCompleto: "HERCULES DE OLIVEIRA",
        adminCpf: "859.851.725-97",
        adminProfissao: "Programador",
        adminEstadoCivil: "Casado(a)",
        adminRegimeCasamento: "Comunhão parcial de bens"
      }
    ],
    endereco: {
      escritorioVirtual: "Não",
      cep: "41100-020",
      endereco: "Rua Cananara",
      numero: "127",
      complemento: "terreo",
      bairro: "Pernambués",
      cidade: "Salvador",
      uf: "BA",
      iptu: "120"
    }
  };

  report.push(`## 2) Enviar etapa 2 (CLIENTE)`);
  const stepResp = await requestJson(`${API_BASE}/processes/${processId}/steps`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      cookie: buildCookie(clientToken)
    },
    body: JSON.stringify({ stepKey: "ETAPA_2", data: step2Payload })
  });
  report.push(`- Status: ${stepResp.res.status}`);
  if (!stepResp.res.ok) {
    report.push(`- Erro: ${JSON.stringify(stepResp.body)}`);
    await fs.writeFile(REPORT_PATH, report.join("\n"));
    throw new Error("Falha ao salvar etapa 2.");
  }
  report.push("");

  const pdfBuffer = await fs.readFile(PDF_PATH);
  const makeForm = () => {
    const form = new FormData();
    form.append("files", new Blob([pdfBuffer], { type: "application/pdf" }), "portaria.pdf");
    return form;
  };

  report.push(`## 3) Upload de documentos`);
  const docUploads = [
    { itemKey: "IDENTIFICACAO_SOCIOS", socioId: socio1Id },
    { itemKey: "COMPROVANTE_RESIDENCIA", socioId: socio1Id },
    { itemKey: "IDENTIFICACAO_SOCIOS", socioId: socio2Id },
    { itemKey: "COMPROVANTE_RESIDENCIA", socioId: socio2Id },
    { itemKey: "FOTO_FACHADA", socioId: null }
  ];

  for (const item of docUploads) {
    const query = item.socioId ? `?socioId=${encodeURIComponent(item.socioId)}` : "";
    const uploadResp = await fetch(
      `${API_BASE}/documents/${processId}/items/${item.itemKey}/upload${query}`,
      {
        method: "POST",
        headers: {
          cookie: buildCookie(clientToken)
        },
        body: makeForm()
      }
    );
    report.push(`- ${item.itemKey}${item.socioId ? ` (${item.socioId})` : ""}: ${uploadResp.status}`);
    if (!uploadResp.ok) {
      const text = await uploadResp.text();
      report.push(`  - Erro: ${text}`);
      await fs.writeFile(REPORT_PATH, report.join("\n"));
      throw new Error("Falha no upload de documentos.");
    }
  }
  report.push("");

  report.push(`## 4) Submeter etapa 2`);
  const submitResp = await requestJson(`${API_BASE}/processes/${processId}/submit-step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: buildCookie(clientToken)
    },
    body: JSON.stringify({ stepKey: "ETAPA_2" })
  });
  report.push(`- Status: ${submitResp.res.status}`);
  if (!submitResp.res.ok) {
    report.push(`- Erro: ${JSON.stringify(submitResp.body)}`);
    await fs.writeFile(REPORT_PATH, report.join("\n"));
    throw new Error("Falha ao submeter etapa 2.");
  }
  report.push("");

  report.push(`## 5) Verificações no banco`);
  const step = await prisma.processStep.findUnique({
    where: { processId_stepKey: { processId, stepKey: "ETAPA_2" } },
    select: { locked: true, status: true }
  });
  report.push(`- Step2 locked: ${step?.locked}`);
  report.push(`- Step2 status: ${step?.status}`);

  const documentCount = await prisma.documentItem.count({ where: { processId } });
  const fileCount = await prisma.documentFile.count({
    where: { item: { processId } }
  });
  report.push(`- Document items: ${documentCount}`);
  report.push(`- Document files: ${fileCount}`);

  report.push("");
  report.push(`## Resultado`);
  report.push(`✅ Fluxo completo executado com sucesso.`);

  await fs.writeFile(REPORT_PATH, report.join("\n"));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
