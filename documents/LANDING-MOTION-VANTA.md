# LANDING-MOTION-VANTA.md

**Проект:** «Континуум»  
**Назначение:** технические и UX-правила для landing-страницы (Vanta Topology + motion), чтобы эти куски кода не “шумели” при ежедневной разработке UI.  
**Важно:** подключать/читать этот документ только при работе над landing и переходом landing → dashboard.

---

## 1) Vanta.js Topology (Landing Background)

**Цель:** атмосферный фон только на landing, без шума на внутренних страницах.

### 1.1 Важная фиксация

Topology использует **p5.js**. Поэтому:

- подключаем через **CDN + `next/script`**
- **не используем npm** `three/vanta` для Topology (избегаем конфликтов и проблем со SPA)

### 1.2 Подключение (Next.js)

Подключаем `p5` и `vanta.topology` через `next/script`, **client-only**.

### 1.3 Инициализация (Polling) и SPA-навигация

**Проблема:** при SPA-переходах/кэше скриптов `VANTA/p5` может быть доступен позже.  
**Решение:** polling до появления `window.VANTA` и `window.p5`.

**Обязательное правило:**

- `init` только после готовности **p5 + VANTA**
- при размонтировании или смене темы — `destroy()`
- при смене темы эффект пересоздаём (`destroy → init`), потому что `setOptions` не всегда корректно обновляет `backgroundColor`

**Пример hook (упрощённый):**

```tsx
import Script from "next/script";
import { useEffect, useRef } from "react";

export function LandingTopology({ theme }: { theme: "light" | "dark" }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const vantaRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const tryInit = () => {
      if (cancelled) return;

      const el = ref.current;
      const VANTA = (window as any).VANTA;
      const p5 = (window as any).p5;

      if (!el || !VANTA?.TOPOLOGY || !p5) {
        requestAnimationFrame(tryInit);
        return;
      }

      if (vantaRef.current) vantaRef.current.destroy();

      const isDark = theme === "dark";
      vantaRef.current = VANTA.TOPOLOGY({
        el,
        p5,
        color: isDark ? 0xffffff : 0x0f172a,
        backgroundColor: isDark ? 0x0f172a : 0xffffff,
        scale: 1.0,
        scaleMobile: 1.0,
      });
    };

    tryInit();

    return () => {
      cancelled = true;
      if (vantaRef.current) {
        vantaRef.current.destroy();
        vantaRef.current = null;
      }
    };
  }, [theme]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/p5@1.4.2/lib/p5.min.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.topology.min.js"
        strategy="afterInteractive"
      />
      <div ref={ref} className="absolute inset-0" />
    </>
  );
}
```
## 2) Motion Design (анимации)

### Принципы
- анимации поддерживают понимание, не украшают
- избегаем `blur` на fullscreen (просадка FPS)
- анимируем `transform` / `opacity`

### Easing для “крупных” переходов
- `cubic-bezier(0.22, 1, 0.36, 1)` (easeOutQuint)

### “Погружение” (Landing → Dashboard)
- `scale` + `opacity`
- длительность: около **2000ms**
- без `blur`

### Performance правило
```css
.animated-layer {
  will-change: transform;
  backface-visibility: hidden;
}
```
## 3) Правила применения

- Vanta и “погружение” используются **только на landing**.
- На внутренних страницах **никаких** постоянных полноэкранных анимированных фонов.