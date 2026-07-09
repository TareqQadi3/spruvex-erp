import React from "react";

type Props = { variant?: "symbol" | "horizontal"; theme?: "light" | "dark"; className?: string };
export function BrandLogo({variant="horizontal", theme="light", className=""}:Props){
  const src = variant === "symbol"
    ? "/brand/logo/spruvex-symbol.svg"
    : theme === "dark" ? "/brand/logo/spruvex-horizontal-dark.svg" : "/brand/logo/spruvex-horizontal-light.svg";
  return <img src={src} className={className} alt="SpruVex" draggable={false}/>;
}
