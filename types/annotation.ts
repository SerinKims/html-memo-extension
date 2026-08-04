export const ANNOTATION_TYPES = ['point', 'text', 'area'] as const;
export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export const ANNOTATION_COLORS = ['yellow', 'red', 'green', 'blue', 'purple'] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export const ANNOTATION_STATUSES = ['open', 'resolved'] as const;
export type AnnotationStatus = (typeof ANNOTATION_STATUSES)[number];

export interface PointPosition {
  xRatio: number;
  yRatio: number;
}

export interface AreaPosition extends PointPosition {
  widthRatio: number;
  heightRatio: number;
}

export interface TextAnchor {
  exactText: string;
  prefixText: string;
  suffixText: string;
  cssSelector?: string;
  startOffset?: number;
  endOffset?: number;
}

interface AnnotationBase {
  id: string;
  pageKey: string;
  originalUrl: string;
  pageTitle: string;
  content: string;
  author: string;
  color: AnnotationColor;
  status: AnnotationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PointAnnotation extends AnnotationBase {
  type: 'point';
  position: PointPosition;
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  anchor: TextAnchor;
}

export interface AreaAnnotation extends AnnotationBase {
  type: 'area';
  position: AreaPosition;
}

export type Annotation = PointAnnotation | TextAnnotation | AreaAnnotation;

type CreateFields = Omit<
  AnnotationBase,
  'id' | 'pageKey' | 'status' | 'createdAt' | 'updatedAt'
> & {
  status?: AnnotationStatus;
};

export type CreateAnnotationInput =
  | (CreateFields & { type: 'point'; position: PointPosition })
  | (CreateFields & { type: 'text'; anchor: TextAnchor })
  | (CreateFields & { type: 'area'; position: AreaPosition });

export type AnnotationChanges = Partial<
  Pick<AnnotationBase, 'pageTitle' | 'content' | 'author' | 'color' | 'status'>
>;
