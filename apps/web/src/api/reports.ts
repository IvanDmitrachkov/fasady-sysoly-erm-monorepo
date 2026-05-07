import { apiJson } from "./http";

export type SalesReportHandleFilter = "with" | "without";

export type SalesReportParams = {
  from: string;
  to: string;
  coatingTypeId?: string;
  millingLabel?: string;
  color?: string;
  handle?: SalesReportHandleFilter;
  customerId?: string;
};

export type SalesReportDto = {
  totals: {
    ordersCount: number;
    facadeCount: number;
    facadeAreaTotal: number;
    totalCost: number;
  };
  filters: {
    coatings: { id: string; name: string }[];
    millingLabels: string[];
    colors: string[];
  };
  orders: {
    id: string;
    orderNumber: number;
    orderNumberFormatted: string;
    completedAt: string | null;
    customer: { id: string; name: string };
    facadeCount: number;
    facadeAreaTotal: number;
    totalCost: number | null;
  }[];
  facades: {
    id: string;
    orderId: string;
    orderNumber: number;
    orderNumberFormatted: string;
    completedAt: string | null;
    customer: { id: string; name: string };
    coatingType: { id: string; name: string };
    millingLabel: string;
    handleLabel: string | null;
    color: string;
    widthMm: number;
    heightMm: number;
    quantity: number;
    thicknessMm: number;
    areaM2: number;
  }[];
};

export type DashboardReportParams = {
  from: string;
  to: string;
};

export type DashboardReportDto = {
  period: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };
  kpis: {
    ordersCount: { value: number; previous: number; trendPercent: number };
    facadeCount: { value: number; previous: number; trendPercent: number };
    areaM2: { value: number; previous: number; trendPercent: number };
    totalMinutes: { value: number; previous: number; trendPercent: number };
    totalRevenue: { value: number; previous: number; trendPercent: number };
  };
  daily: {
    date: string;
    ordersCount: number;
    facadeCount: number;
    minutes: number;
  }[];
  stageBreakdown: {
    stageId: string;
    stageName: string;
    minutes: number;
  }[];
};

export type MaterialsReportParams = {
  from: string;
  to: string;
  customerId?: string;
  stageId?: string;
  userId?: string;
  name?: string;
  unit?: string;
};

export type MaterialsReportDto = {
  totals: {
    entriesCount: number;
    totalQuantity: number;
    ordersCount: number;
    materialNamesCount: number;
  };
  filters: {
    names: string[];
    units: string[];
    stages: { id: string; name: string }[];
    users: { id: string; name: string }[];
  };
  byName: { name: string; quantity: number }[];
  byStage: { stageId: string; stageName: string; quantity: number }[];
  entries: {
    id: string;
    usedAt: string;
    name: string;
    kind: string | null;
    unit: string;
    quantity: number;
    comment: string | null;
    order: {
      id: string;
      orderNumber: number;
      orderNumberFormatted: string;
      customer: { id: string; name: string };
    };
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      patronymic: string | null;
      email: string;
    };
    stage: { id: string; name: string } | null;
  }[];
};

export type FacadesReportParams = {
  from: string;
  to: string;
  customerId?: string;
  coatingTypeId?: string;
  millingLabel?: string;
  color?: string;
};

export type FacadesReportDto = {
  totals: {
    ordersCount: number;
    facadeCount: number;
    facadeAreaTotal: number;
    linesCount: number;
  };
  filters: {
    coatings: { id: string; name: string }[];
    millingLabels: string[];
    colors: string[];
  };
  byCoating: {
    coatingTypeId: string;
    coatingTypeName: string;
    quantity: number;
    areaM2: number;
  }[];
  byMilling: {
    millingLabel: string;
    quantity: number;
    areaM2: number;
  }[];
  facades: {
    id: string;
    order: {
      id: string;
      orderNumber: number;
      orderNumberFormatted: string;
      completedAt: string | null;
      customer: { id: string; name: string };
    };
    coatingType: { id: string; name: string };
    millingLabel: string;
    color: string;
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
    quantity: number;
    areaM2: number;
  }[];
};

export function salesReport(params: SalesReportParams) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  if (params.coatingTypeId) q.set("coatingTypeId", params.coatingTypeId);
  if (params.millingLabel) q.set("millingLabel", params.millingLabel);
  if (params.color) q.set("color", params.color);
  if (params.handle) q.set("handle", params.handle);
  if (params.customerId) q.set("customerId", params.customerId);
  return apiJson<SalesReportDto>(`/api/reports/sales?${q.toString()}`);
}

export function dashboardReport(params: DashboardReportParams) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  return apiJson<DashboardReportDto>(`/api/reports/dashboard?${q.toString()}`);
}

export function materialsReport(params: MaterialsReportParams) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  if (params.customerId) q.set("customerId", params.customerId);
  if (params.stageId) q.set("stageId", params.stageId);
  if (params.userId) q.set("userId", params.userId);
  if (params.name) q.set("name", params.name);
  if (params.unit) q.set("unit", params.unit);
  return apiJson<MaterialsReportDto>(`/api/reports/materials?${q.toString()}`);
}

export function facadesReport(params: FacadesReportParams) {
  const q = new URLSearchParams();
  q.set("from", params.from);
  q.set("to", params.to);
  if (params.customerId) q.set("customerId", params.customerId);
  if (params.coatingTypeId) q.set("coatingTypeId", params.coatingTypeId);
  if (params.millingLabel) q.set("millingLabel", params.millingLabel);
  if (params.color) q.set("color", params.color);
  return apiJson<FacadesReportDto>(`/api/reports/facades?${q.toString()}`);
}
