import { apiJson } from "./http";

export type CuttingPlacementDto = {
  facadeId: string;
  label: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
};

export type CuttingSheetDto = {
  sheetIndex: number;
  widthMm: number;
  heightMm: number;
  placements: CuttingPlacementDto[];
};

export type CuttingOverflowDto = {
  facadeId: string;
  sortIndex: number;
  label: string;
  reason: string;
};

export type CuttingGroupDto = {
  material: string;
  thicknessMm: number;
  sheets: CuttingSheetDto[];
  overflow: CuttingOverflowDto[];
};

export type CuttingPlanDto = {
  orderId: string;
  orderNumberFormatted: string;
  material: string;
  sheetSize: { widthMm: number; heightMm: number };
  groups: CuttingGroupDto[];
};

export function cuttingPlanGet(orderId: string) {
  return apiJson<CuttingPlanDto>(`/api/orders/${orderId}/cutting`);
}

export function cuttingPdfPath(orderId: string) {
  return `/api/orders/${orderId}/cutting.pdf`;
}
