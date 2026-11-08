import ReadingQuestion from '@/components/interactive-lesson/authoring/ReadingQuestion';

export default function PrototypeReadingQuestion() {
  return <ReadingQuestion
    id="motion-question"
    title="Как называется раздел механики, который описывает движение тел?"
    answer="кинематика"
    explanation="Кинематика описывает движение тел, а динамика объясняет его причины."
    prototypeStorageKey="continuum:prototype:kin-01:motion-question:v1"
  />;
}
