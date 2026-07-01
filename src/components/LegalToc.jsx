"use client";

import { useEffect, useState } from "react";

export function LegalToc({ items }) {
  const [activeId, setActiveId] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={`text-sm py-1.5 pl-4 border-l-2 transition-colors ${
            activeId === item.id
              ? "border-primary text-primary font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
