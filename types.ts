export type Point = {
  x: number;
  y: number;
};

export type Stroke = {
  points: Point[];
  size: number;
};

export enum ToolType {
  BRUSH = 'BRUSH',
  HAND = 'HAND',
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  EDIT = 'EDIT',
  PROCESSING = 'PROCESSING',
  COMPARE = 'COMPARE',
}

export interface ImageDimensions {
  width: number;
  height: number;
}
