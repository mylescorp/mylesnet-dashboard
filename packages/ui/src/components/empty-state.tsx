export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
    </div>
  );
}
