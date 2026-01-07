
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

export enum AppMode {
  HOME = 'HOME',
  WATERMARK = 'WATERMARK',
  STORYBOARD = 'STORYBOARD',
  SPLITTER = 'SPLITTER',
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface StoryboardShot {
  id: number;
  shotTypeCn: string;
  shotTypeEn: string;
  contentCn: string;
  contentEn: string;
  isRegenerating?: boolean;
}

export interface StoryboardData {
  mainPromptCn: string;
  mainPromptEn: string;
  shots: StoryboardShot[];
}
