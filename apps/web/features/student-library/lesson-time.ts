export const lessonTimeValue = (time: number) => time.toFixed(1).replace('.', ',');
export const lessonTimeReadout = (time: number) => `${lessonTimeValue(time)} с`;
export const lessonTimeArgument = (time: number) => `(${Math.floor(time)})`;
