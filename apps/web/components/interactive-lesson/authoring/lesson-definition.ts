import type { ComponentType } from 'react';
import type { InteractiveLessonManifest } from '@continuum/shared';

export type LessonDefinition = Pick<InteractiveLessonManifest, 'lessonId' | 'title' | 'sections' | 'questions'> & {
  articleId: string;
  titleId: string;
  context: string;
  Content: ComponentType;
};
