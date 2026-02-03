import type { TextareaHTMLAttributes } from "react";
import styles from "./textarea.module.css";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Textarea({ className = "", ...props }: TextareaProps) {
  return <textarea className={`${styles.textarea} ${className}`} {...props} />;
}
