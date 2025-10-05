// src\components\SchemaBlocks.tsx
// src/components/SchemaBlocks.tsx
import { h } from "preact";

type OrgProps = { name: string; url: string; logo?: string; areaServed?: string[] };
export function OrgSchema({ name, url, logo, areaServed }: OrgProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": ["Organization", "HomeAndConstructionBusiness"],
    name, url, logo, areaServed,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

type ServiceProps = { name: string; areaServed?: string[]; url: string };
export function ServiceSchema({ name, areaServed, url }: ServiceProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Service",
    name, areaServed, url,
    provider: { "@type": "Organization", name: "Tu Marca" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

type ProductProps = {
  name: string; sku?: string; url: string;
  m2PerGal?: number | string; voc?: number | string; solids?: number | string; offers?: any;
};
export function ProductOfferSchema({ name, sku, url, m2PerGal, voc, solids, offers }: ProductProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name, sku, url,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Rendimiento (m²/gal/mano)", value: m2PerGal },
      { "@type": "PropertyValue", name: "VOC (g/L)", value: voc },
      { "@type": "PropertyValue", name: "Sólidos (%)", value: solids },
    ],
    offers,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function BreadcrumbFachadas({ currentUrl }: { currentUrl: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Soluciones", item: "https://tu-dominio.ve/soluciones" },
      { "@type": "ListItem", position: 2, name: "Fachadas Caracas", item: currentUrl },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
