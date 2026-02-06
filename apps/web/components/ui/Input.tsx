import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./input.module.css";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className = "", ...props }, ref) => {
  return <input ref={ref} className={`${styles.input} ${className}`} {...props} />;
});

Input.displayName = "Input";

export default Input;
