import type { ComponentProps } from 'react';
import Controls from '@/components/interactive-lesson/authoring/LessonPlaybackControls';
import { DemoNumber, type Demonstration } from './LessonDemonstration';

export default function LessonPlaybackControls({ demo, ...props }: Omit<ComponentProps<typeof Controls>, 'number'> & { demo: Demonstration }) {
  return <Controls {...props} number={<DemoNumber demo={demo} />} />;
}
