export type ProcessValue = string | number | boolean | null | undefined | ProcessRecord | ProcessValue[];

export type ProcessRecord = { [key: string]: ProcessValue };

export interface ProcessAddress extends ProcessRecord {
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  iptu?: string;
  escritorioVirtual?: string;
}

export interface ProcessCorrection extends ProcessRecord {
  fields?: string[];
}

export interface ProcessStepData extends Record<string, ProcessValue> {
  endereco?: ProcessAddress;
  quadroSocietario?: ProcessValue;
  correction?: ProcessCorrection;
}

export interface ProcessStep {
  stepKey: string;
  data: ProcessStepData;
  locked?: boolean;
}

export interface ProcessFile {
  id: string;
  fileName: string;
  uploadedByRole?: string | null;
  [key: string]: ProcessValue;
}

export interface ProcessDocument {
  id: string;
  itemKey: string;
  socioId?: string | null;
  status?: string | null;
  files?: ProcessFile[];
  [key: string]: ProcessValue;
}

export interface ProcessChatMessage {
  id?: string;
  body?: string;
  senderRole?: string;
  createdAt?: string;
  [key: string]: ProcessValue;
}

export interface ProcessData {
  id: string;
  status: string;
  currentStep: string;
  steps: ProcessStep[];
  documents?: ProcessDocument[];
}

export interface MunicipalityData extends ProcessRecord {
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  UF?: { sigla?: string };
}

export function toProcessRecords(value: ProcessValue | undefined): ProcessRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is ProcessRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)));
  }
  return value && typeof value === "object" ? [value] : [];
}
