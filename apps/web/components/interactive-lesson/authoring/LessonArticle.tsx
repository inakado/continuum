import type { LessonDefinition } from './lesson-definition';
import styles from './lesson-article.module.css';

export default function LessonArticle({ definition }: { definition: LessonDefinition }) {
  const { Content } = definition;
  return <div className={styles.page} data-packaged-lesson>
    <main className={styles.main}>
      <article id={definition.articleId} aria-labelledby={definition.titleId} data-reading-scale="100">
        <header className={styles.intro} data-lesson-intro>
          <div className={styles.context}>{definition.context}</div>
          <h1 id={definition.titleId} data-lesson-section>{definition.title}</h1>
        </header>
        <Content />
      </article>
    </main>
  </div>;
}
