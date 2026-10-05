export function SectionHeading({
  title,
  eyebrow,
  as = "h2",
}: {
  title: string;
  eyebrow?: string;
  as?: "h1" | "h2";
}) {
  const Tag = as;
  return (
    <div className="section-heading">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <Tag>{title}</Tag>
    </div>
  );
}
