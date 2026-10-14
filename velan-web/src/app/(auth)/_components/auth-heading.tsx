/** Title block used at the top of each auth card. */
export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-1.5 text-center">
      <h1 className="font-heading text-xl font-semibold tracking-tight text-ink">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
