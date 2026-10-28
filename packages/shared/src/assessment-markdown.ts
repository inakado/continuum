import { Marked, type Token, type Tokens } from 'marked';

export type AssessmentMarkdownNode =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'link'; href: string; children: AssessmentMarkdownNode[] }
  | { kind: 'element'; tag: 'p' | 'strong' | 'em' | 'del' | 'ul' | 'ol' | 'li' | 'table' | 'thead' | 'tbody' | 'tr' | 'th' | 'td' | 'h3' | 'blockquote' | 'br'; align?: 'left' | 'center' | 'right'; children: AssessmentMarkdownNode[] };

export const assessmentImagePath = /^images\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(?:png|jpe?g|webp)$/;
const markdown = new Marked({ gfm: true, breaks: false });
markdown.use({ extensions: [
  { name: 'assessmentBlockMath', level: 'block', tokenizer(src) {
    const match = /^\$\$(?!\$)((?:\\.|[^$])+?)\$\$(?!\$)(?:\n|$)/.exec(src);
    if (match) return { type: 'assessmentMath', raw: match[0], text: match[1], display: true };
  } },
  { name: 'assessmentInlineMath', level: 'inline', start: (src) => src.indexOf('$'), tokenizer(src) {
    const display = /^\$\$(?!\$)((?:\\.|[^$\n])+?)\$\$(?!\$)/.exec(src);
    if (display) return { type: 'assessmentMath', raw: display[0], text: display[1], display: true };
    const match = /^\$(?!\$)((?:\\.|[^$\n])+?)\$(?!\$)/.exec(src);
    if (match) return { type: 'assessmentMath', raw: match[0], text: match[1], display: false };
  } },
] });

function nodes(tokens: Token[], depth = 0): AssessmentMarkdownNode[] {
  if (depth > 20) throw new Error('Слишком глубокая вложенность Markdown.');
  const element = (tag: Extract<AssessmentMarkdownNode, { kind: 'element' }>['tag'], children: AssessmentMarkdownNode[]): AssessmentMarkdownNode => ({ kind: 'element', tag, children });
  const children = (items: Token[] = []) => nodes(items, depth + 1);
  return tokens.flatMap((token): AssessmentMarkdownNode[] => {
    switch (token.type) {
      case 'space': return [];
      case 'assessmentMath': {
        const value = String(token.text);
        if (value.length > 4000 || /\\(?:require|href|url|html\w*|includegraphics|input|include|def|gdef|edef|newcommand|renewcommand|let|csname)\b/i.test(value)) throw new Error('Недопустимая команда в формуле.');
        return [{ kind: 'math', value, display: Boolean(token.display) }];
      }
      case 'html': throw new Error('HTML в заданиях запрещён.');
      case 'image': {
        const image = token as Tokens.Image;
        if (!assessmentImagePath.test(image.href)) throw new Error('Рисунок должен ссылаться на локальный файл images/*.png, jpg или webp.');
        return [{ kind: 'image', src: image.href, alt: image.text }];
      }
      case 'link': {
        const link = token as Tokens.Link;
        if (!/^https:\/\//i.test(link.href)) throw new Error('Разрешены только HTTPS-ссылки.');
        return [{ kind: 'link', href: link.href, children: children(link.tokens) }];
      }
      case 'text': case 'escape': {
        const text = token as Tokens.Text;
        if (token.type === 'text' && !text.tokens && text.raw.includes('$')) throw new Error('Проверьте парность разделителей формул $…$ и $$…$$. Литерал $ запишите как \\$ .');
        return text.tokens ? children(text.tokens) : [{ kind: 'text', value: token.type === 'text' ? text.text.replace(/(^|\s)---(?=\s|$)/g, '$1—') : text.text }];
      }
      case 'paragraph': return [element('p', children((token as Tokens.Paragraph).tokens))];
      case 'heading': return [element('h3', children((token as Tokens.Heading).tokens))];
      case 'strong': return [element('strong', children((token as Tokens.Strong).tokens))];
      case 'em': return [element('em', children((token as Tokens.Em).tokens))];
      case 'del': return [element('del', children((token as Tokens.Del).tokens))];
      case 'br': return [element('br', [])];
      case 'blockquote': return [element('blockquote', children((token as Tokens.Blockquote).tokens))];
      case 'list': {
        const list = token as Tokens.List;
        return [element(list.ordered ? 'ol' : 'ul', list.items.map((item) => element('li', children(item.tokens))))];
      }
      case 'table': {
        const table = token as Tokens.Table;
        const cellNode = (tag: 'th' | 'td', cell: Tokens.TableCell): AssessmentMarkdownNode => ({ ...element(tag, children(cell.tokens)), ...(cell.align ? { align: cell.align } : {}) });
        return [element('table', [element('thead', [element('tr', table.header.map((cell) => cellNode('th', cell)))]), element('tbody', table.rows.map((row) => element('tr', row.map((cell) => cellNode('td', cell)))))])];
      }
      default: throw new Error(`Неподдерживаемый элемент Markdown: ${token.type}.`);
    }
  });
}

export function parseAssessmentMarkdown(source: string): AssessmentMarkdownNode[] {
  if (source.length > 120_000) throw new Error('Текст задания превышает 120 000 символов.');
  return nodes(markdown.lexer(source));
}

export function assessmentMarkdownImages(tree: AssessmentMarkdownNode[]): string[] {
  return tree.flatMap((node) => node.kind === 'image' ? [node.src] : 'children' in node ? assessmentMarkdownImages(node.children) : []);
}
