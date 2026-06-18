export default function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="border border-dashed rounded-lg p-12 text-center text-muted-foreground">
        Módulo en construcción — siguiente iteración.
      </div>
    </div>
  );
}
