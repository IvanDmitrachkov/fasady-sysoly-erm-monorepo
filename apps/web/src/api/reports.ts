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
