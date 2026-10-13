import type { FormEvent, ReactNode } from "react";
import { PageHeader } from "./page-header";

export interface ListPageTemplateProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  bulkActions?: ReactNode;
  selectedCount?: number;
  table: ReactNode;
  mobileCards?: ReactNode;
  footer?: ReactNode;
}

/** Shared list layout. Supply real filter, table, selection, and mobile content. */
export function ListPageTemplate({
  title,
  description,
  actions,
  filters,
  bulkActions,
  selectedCount = 0,
  table,
  mobileCards,
  footer,
}: ListPageTemplateProps) {
  return (
    <div className={`mn-page-template mn-list-page${mobileCards != null ? " mn-list-page-has-mobile-cards" : ""}`}>
      <PageHeader title={title} description={description} actions={actions} />
      <div className="mn-list-toolbar">
        {selectedCount > 0 ? bulkActions : filters}
      </div>
      <section className="mn-template-card" aria-label={`${title} list`}>
        <div className="mn-list-table">{table}</div>
        {mobileCards != null ? <div className="mn-list-mobile-cards">{mobileCards}</div> : null}
        {footer != null ? <footer className="mn-template-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export interface FormPageTemplateProps {
  title: string;
  description?: string;
  children: ReactNode;
  summary: ReactNode;
  cancelHref: string;
  saveLabel?: string;
  saving?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** Two-column form frame. Field labels, validation, and form state belong to the form. */
export function FormPageTemplate({
  title,
  description,
  children,
  summary,
  cancelHref,
  saveLabel = "Save",
  saving = false,
  onSubmit,
}: FormPageTemplateProps) {
  return (
    <div className="mn-page-template">
      <PageHeader title={title} description={description} />
      <div className="mn-form-layout">
        <form className="mn-template-card mn-form-card" onSubmit={onSubmit}>
          <div className="mn-form-fields">{children}</div>
          <footer className="mn-template-footer">
            <a className="mn-template-cancel" href={cancelHref}>Cancel</a>
            <button className="mn-template-save" type="submit" disabled={saving}>
              {saving ? "Saving" : saveLabel}
            </button>
          </footer>
        </form>
        <aside className="mn-template-summary" aria-label="Summary">{summary}</aside>
      </div>
    </div>
  );
}

export interface DetailTab {
  href: string;
  label: string;
  current?: boolean;
}

/** Record detail frame with a status slot and route-backed tabs. */
export function DetailPageTemplate({
  title,
  description,
  status,
  actions,
  tabs,
  children,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  actions?: ReactNode;
  tabs: DetailTab[];
  children: ReactNode;
}) {
  return (
    <div className="mn-page-template">
      <PageHeader
        title={title}
        description={description}
        actions={<div className="mn-detail-actions">{status}{actions}</div>}
      />
      <nav className="mn-detail-tabs" aria-label={`${title} sections`}>
        {tabs.map((tab) => (
          <a key={tab.href} href={tab.href} aria-current={tab.current ? "page" : undefined}>
            {tab.label}
          </a>
        ))}
      </nav>
      <div className="mn-detail-content">{children}</div>
    </div>
  );
}
