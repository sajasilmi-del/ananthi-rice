import Image, { type ImageProps } from "next/image";

type CatalogImageProps = Omit<ImageProps, "unoptimized" | "priority" | "loading"> & {
  priority?: boolean;
};

export function CatalogImage({ priority = false, alt, ...props }: CatalogImageProps) {
  const unoptimized = process.env.NODE_ENV !== "production";
  if (priority) return <Image {...props} alt={alt} priority unoptimized={unoptimized} />;
  return <Image {...props} alt={alt} loading="lazy" unoptimized={unoptimized} />;
}
